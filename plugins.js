const axios = require("axios");
const yamlFront = require("yaml-front-matter");
import { promises as fs } from "fs";
import path from "path";
import getMetaData from "metadata-scraper";
import isbn from "node-isbn";
import { formats } from "./src/components/cite/formats";
import wikipedia from 'wikipedia'; 

const webFormats = [
    "",
    "htm",
    "html",
    "asax",
    "vrt",
    "dll",
    "php",
    "xul",
    "dhtml",
    "cshtml",
    "dochtml",
    "shtml",
    "xhtm",
    "rss",
    "asp",
    "mhtml",
    "jsp",
    "cgi",
];

const pages = (...paths) => path.join('.','src','pages',...paths);
const hasIndex = (arr) => arr[top].includes('index.tsx') || arr[top].includes('index.mdx');

export const fsTree = new Promise(async (res, rej) => {
    const topLevel = await fs.readdir(pages());
    const tree = {};
    for(const top of topLevel){
        const subStat = await fs.stat(pages(top));
        if (subStat.isDirectory()) {
            tree[top] = await fs.readdir(pages(top));
        }else{
            tree[top] = top;
        }
    }
    res(tree);
});

export async function getRoutes(){
    const tree = await fsTree;
    const missingIndexes = [];
    for(const top in tree) {
        if(Array.isArray(tree[top])){
            if(!hasIndex(tree[top])){
                missingIndexes.push(top);
            }
            for(const sub of tree[top]){
                if((await fs.stat(pages(top, sub))).isDirectory()){
                    if(!hasIndex(await fs.readdir(pages(top,sub)))){
                        missingIndexes.push(`${top}/${sub}`);
                    }
                }
                
            }
        }        
    }
    return [...missingIndexes.map(index => ({
    }))]
}

export const doRoutePreprocess = (data) => async () => {
    const frontMatter = yamlFront.loadFront(await fs.readFile(data.template));
    const content = frontMatter.__content;
    // We don't need a bundle of content bloating up page size
    delete frontMatter.__content;
    /**
     * Regex explaination:
     * https?:\/\/ : look for https:// or http://
     * [[-\]_.~!*'();:@&=+$,/?%#[A-z0-9]]+ : match any url-allowed character
     */
    const urlMatches =
        content.match(/https?:\/\/[\-[-\]_.~*@&=+$,/?%#[A-z0-9]+/g) || [];
    const fmCites = frontMatter.additionalCites || [];
    const urls = [...new Set([...urlMatches, ...fmCites])];

    const urlMeta = {};
    const urlMetaList = await Promise.all(
        urls.map(async (url) => {
            const urlParts = new URL(url).pathname.split("/");
            const lastPart = urlParts[urlParts.length - 1].split(".");
            if (
                lastPart.length > 1 &&
                !(lastPart[lastPart.length - 1] in webFormats) &&
                lastPart[lastPart.length - 1].length < 7
            ) {
                //probably an asset tbh
                return null;
            }
            try {
                if (url.match(formats.doi)) {
                    return (
                        await axios.get(url, {
                            headers: {
                                Accept: "application/vnd.citationstyles.csl+json",
                            },
                        })
                    ).data;
                }
                if (url.match(formats.isbn)) {
                    return await isbn.resolve(
                        url.slice("https://openlibrary.org/isbn/".length)
                    );
                }
                if (url.match(formats.youtube)) {
                    const request = await axios.get("https://youtube.com/oembed", {
                        params: {
                            url,
                            format: "json",
                        },
                    });
                    return request.data;
                }
                if(url.match(formats.wikipedia)){
                    const page = await wikipedia.page(decodeURI(urlParts[urlParts.length-1]));
                    const [summary, infobox] = await Promise.all([
                      page.summary(),
                      page.infobox(),
                    ]);
                    for(const key in infobox){
                        if(infobox[`${key}Caption`] != null){
                            delete infobox[key];
                            delete infobox[`${key}Caption`];
                            delete infobox[`${key}Alt`];
                        }
                    }
                    return {
                        title: summary.title,
                        short: summary.extract_html,
                        thumbnail: summary.thumbnail,
                        infobox:infobox,
                    }
                }
            } catch (e){
                //Default to scraping the url if it looks bad qq
                console.log('something went wrong');
                console.log(e);
            }
            //We don't know of anything better; scrape the url
            try{
                return await getMetaData(url);
            }catch{
                return null;
            }
            
        })
    );

    for (let i = 0; i < urlMetaList.length; i++) {
        if (urlMetaList[i] != null) {
            urlMeta[urls[i]] = urlMetaList[i];
        }
    }
    const ret = {
        frontMatter,
        urlMeta,
        location: data.path,
    };
    if (data.template.match(/index\.(jsx|tsx|mdx)$/g)) {
      const dir = data.template.slice(0, -"index.tsx".length);
      const subPaths = await fs.readdir(dir);
      ret.subPaths = {};
      for (const subPath of subPaths) {
        if (subPath.match(/^index\.(jsx|tsx|mdx)$/g)||!subPath.match(/(jsx|tsx|mdx)$/g)) {
          continue;
        }
        try{
            const subUrl = subPath.slice(0,-('.mdx'.length));
            ret.subPaths[subUrl] = yamlFront.loadFront(
              await fs.readFile(`${dir}/${subPath}`)
            );
            delete ret.subPaths[subUrl].__content;
        }catch{
            console.log('jfiowejfiowej');
        }
        
      }
    }
    return ret;
};
