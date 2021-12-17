import React from 'react';
import { formats, Format } from './formats';

import './citation.scss';

export const Citation: React.FC<{
    url: string,
}> = ({url, children}) => (<div>
    <br></br>{url}<br></br>{children}
</div>);

const resolvers : {
    [key in Format] : (url: string, obj: any) => React.ReactElement;
} = {
    youtube: (url, data) => <BibEle 
        authors={[[data.author_name]]}
        title={data.title}
        url={url}
        // Todo: Get Video published date.
        />,
    doi: (url, data) => <BibEle
        authors={data.author.map(({given, family}: any) => [given, family])}
        url={url}
        title={data.title}
        vol={`vol. ${data.volume}`}
        pages={data.page != null ? data.page.split('-'):null}
        workTitle={data['container-title']}
        year={data.published['date-parts'][0][0]}
    />,
    isbn: (url, data) => <BibEle
        authors={data.authors.map((s:string) => s.split(' '))}
        title={data.title}
        url={url}
        year={data.publishedDate}
    />,
};

export const Bibliography: React.FC<{
    works: {
        [url: string]: string | object;
    };
}> = ({works}) => (
    <p id="bib">
        <h1>Works Consulted</h1>
        {Object.entries(works).map(([url, data]) => {
            if(typeof data === 'string') {
                return data;
            }
            for(const format in formats){
                if(url.match(formats[format as Format])){
                    return resolvers[format as Format](url, data);
                }
            }
        })}
    </p>
)

const mlaDateFormat = (date: Date) => date.toLocaleDateString('en-us', {
    month:'short',
    year: 'numeric',
    day: 'numeric',
});

const BibEle: React.FC<{
    authors: string[][];
    title: string;
    workTitle?:string;
    url: string;
    year?: string;
    published?: Date;
    vol?: string;
    pages?: [string, string];
    accessed?: Date;
}> = ({authors, title, url, ...props}) => <p className='cite'> <a href={url}>
    {authors.map(author => {
        let name = author[author.length-1];
        if(author.length > 1){
            name += ', '
            name += author.slice(0,-1).join(' ');
        }
        return name;
    }).reduce(
        (first, second, index) => first + ((index == authors.length - 1)? ', and ' : ', ') + second) + '. '
    }
    "{title.replace('"','\'')}." {props.workTitle != null && <em>{props.workTitle}, </em>}
    {props.vol != null && props.vol + ', '}{props.year != null && props.year + ', '}
    {props.pages != null && `${props.pages[0]}-${props.pages[1]}, `} 
    {props.published && `Published ${mlaDateFormat(props.accessed)}`}{props.accessed != null && `Accessed ${mlaDateFormat(props.accessed)}`}.
    </a>
</p>;