const axios = require("axios");
const yamlFront = require("yaml-front-matter");
import { promises as fs } from "fs";
import getMetaData from "metadata-scraper";
import isbn from "node-isbn";
import { formats } from "./src/components/cite/formats";

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
      } catch {
        //Default to scraping the url if it looks bad qq
      }
      //We don't know of anything better; scrape the url
      return getMetaData(url);
    })
  );

  for (let i = 0; i < urlMetaList.length; i++) {
    if (urlMetaList[i] != null) {
      urlMeta[urls[i]] = urlMetaList[i];
    }
  }
  return {
    frontMatter,
    urlMeta,
    location: data.path,
  };
};
