import React from 'react';
import { ThemeSwitcher } from '../colors';
import './footer.scss';
import { useRouteData } from 'react-static';
const licences : {
    [key:string]: (a: {title:string, url:string, preface?:string}) => JSX.Element;
} = {
  "CC-BY-NC-4.0": ({title, url, preface}) => (
    <p
      // @ts-ignore:
      xmlnsCc="http://creativecommons.org/ns#"
      xmlnsDct="http://purl.org/dc/terms/"
    > {preface} <a
        property="dct:title"
        rel="cc:attributionURL"
        href={url}
      >
        {title}
      </a> by <a
        rel="cc:attributionURL dct:creator"
        property="cc:attributionName"
        href="https://skyedelaciel.com"
      >
        Sydney Yin
      </a> is licensed under <a
        href="http://creativecommons.org/licenses/by-nc/4.0/?ref=chooser-v1"
        target="_blank"
        rel="license noopener noreferrer"
        style={{ display: "inline-block" }}
      > CC BY-NC 4.0
        <img
          src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1"
        />
        <img
          src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1"
        />
        <img
          src="https://mirrors.creativecommons.org/presskit/icons/nc.svg?ref=chooser-v1"
        />
      </a>
    </p>
  ),
};
export const Footer: React.FC<{}> = () => {
    const {route, frontMatter} = useRouteData();
    console.log(useRouteData());
    return (
      <>
        <hr />
        <footer>
          {licences["CC-BY-NC-4.0"]({
            title: "Skyedelaciel",
            url: "https://skyedelaciel.com",
          })}
          {licences[frontMatter.licence] != null &&
            licences[frontMatter.licence]({
              title: frontMatter.title,
              url: `https://skyedelaciel.com${route}`,
              preface: "The content of this page,",
            })}
          <p className='footerBits'>
            <IconLink
              href="https://github.com/PrecociouslyDigital/skyedelaciel"
              icon="github"
            />
            <IconLink href="https://twitter.com/skyedelaciel" icon="twitter" />
            <IconLink
              href="mailto:sydney@skyedelaciel.com"
              icon="envelope"
              type="fas"
            />
            <ThemeSwitcher />
          </p>
        </footer>
      </>
    );
};

const IconLink: React.FC<{href: string, icon: string, type?: string}> = ({href, icon, type='fab'}) => (
    <a href={href}><i className={`${type} fa-${icon}`} aria-hidden="true"></i></a>
)