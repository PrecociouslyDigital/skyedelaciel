import path from 'path';
const axios = require('axios');
const yamlFront = require('yaml-front-matter');
import { promises as fs } from 'fs';
import getMetaData from 'metadata-scraper';
import isbn from 'node-isbn';
import { formats } from './src/components/cite/formats';
import { extname } from 'path';
require('dotenv');

const webFormats = ['', 'htm', 'html', 'asax', 'vrt', 'dll', 'php', 'xul', 'dhtml', 'cshtml', 'dochtml', 'shtml', 'xhtm', 'rss', 'asp', 'mhtml', 'jsp', 'cgi'];

// Typescript support in static.config.js is not yet supported, but is coming in a future update!

export default {
    entry: path.join(__dirname, 'src', 'index.tsx'),
    getRoutes: async () => {
        return [
        ]
    },
    plugins: [
        'react-static-plugin-typescript',
        [
            require.resolve('react-static-plugin-source-filesystem'),
            {
                location: path.resolve('./src/pages'),
                createRoute: (data) => ({
                    getData: async () => {
                        const frontMatter = yamlFront.loadFront(await fs.readFile(data.template));
                        const content = frontMatter.__content;
                        // We don't need a bundle of content bloating up page size
                        delete frontMatter.__content;
                        /**
                         * Regex explaination:
                         * https?:\/\/ : look for https:// or http://
                         * [[-\]_.~!*'();:@&=+$,/?%#[A-z0-9]]+ : match any url-allowed character
                         */
                        const urlMatches = content
                                .match(/https?:\/\/[[-\]_.~*@&=+$,/?%#[A-z0-9]+/g) || [];
                        const fmCites = frontMatter.additionalCites || [];
                        const urls = [...new Set(
                            [...urlMatches,
                            ...fmCites])];

                        const urlMeta = {};
                        const urlMetaList = await Promise.all(urls.map(async url => {
                            if(!(extname(url) in webFormats)){
                                //probably an asset tbh
                                return null;
                            }
                            try{
                                if(url.match(formats.doi)){
                                    return (await axios.get(url, {
                                        headers:{
                                            'Accept': 'application/vnd.citationstyles.csl+json'
                                        }
                                    })).data;
                                }
                                if(url.match(formats.isbn)){
                                    return await isbn.resolve(url.slice('https://openlibrary.org/isbn/'.length));
                                }
                                if(url.match(formats.youtube)){
                                    const request = await axios.get('https://youtube.com/oembed',{
                                        params:{
                                            url,
                                            format: 'json'
                                        }
                                    });
                                    return request.data
                                }
                            }catch{
                                //Default to scraping the url if it looks bad qq
                            }
                            //We don't know of anything better; scrape the url
                            return await getMetaData(url);
                        }));
                        
                        for(let i = 0; i < urls.length; i++){
                            if(urlMetaList != null){
                                urlMeta[urls[i]] = urlMetaList[i];
                            }
                        }
                        return {
                            frontMatter,
                            urlMeta,
                            location: data.path,
                        }
                    },
                   ...data,
                }),
            },
        ],
        require.resolve('react-static-plugin-reach-router'),
        require.resolve('react-static-plugin-sass'),
        require.resolve('react-static-plugin-sitemap'),
        [
            require.resolve('react-static-plugin-mdx'),
            {
                parseFrontMatter: true,
            }
        ],
        [
            require.resolve('react-static-plugin-css-modules'),
            {
                 modules: true, // set true by default
                 localIdentName: '[path][name]__[local]--[hash:base64:5]', // just an example
                 // any other options you wish from css-loader
                 // want to use sass? you can track it down in your webpack build and add the loader
                 // otherwise open an issue tagging @ScriptedAlchemy. He will enhance the options if required 
             }
        ],
    ],
}
