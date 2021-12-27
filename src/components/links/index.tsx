import React from 'react';
import { Link as ReachLink } from '@reach/router';
import { Popup } from '../popup';
import { resolvers } from 'components/cite';
import { formats, Format } from 'components/cite/formats';
import { useRouteData } from 'react-static';
import './links.scss';

const defaultPopup =  (url: string, data: any) => <div className="preview">
        <div><p><a href={url}><em>{data.title}</em></a></p>
        {data.description && <p>{data.description}</p>}</div>
        {data.thumbnail_url != null && <img className='thumbnail right' src={data.thumbnail_url}></img>}
    </div>;


const popups : {
    [key in Format] : (url: string, obj: any) => React.ReactElement;
} = {
    youtube: (url, data) => <>
        <p><a href={url}><em>{data.title}</em></a></p>
        <img className='thumbnail' src={data.thumbnail_url}></img>
    </>,
    doi: (url, data) => <div className="preview">{resolvers.doi(url, data)}</div>,
    isbn: (url: string, data: any) => <div className="preview">
        <div><p><a href={url}><em>{data.title}</em></a></p>
        {data.description && <p>{data.description}</p>}</div>
        <img className='thumbnail right' src={data.imageLinks.thumbnail}></img>
    </div>,
};



export const JumpLink : React.FC<{href: string}>=({href, children}) => (
    <ReachLink to={href}>
        {children}
    </ReachLink>); 

export const InternalLink : React.FC<{href: string}>=({href, children}) => (
    <Popup content={<div>hello</div>}><ReachLink to={href}>
        {children}
    </ReachLink></Popup>); 

export const ExternalLink : React.FC<{href: string}>=({href, children}) => (
    <Popup content={<LinkPreview url={href}/>}><a href={href}>
        {children}
    </a></Popup>); 

export const Link : React.FC<{href: string}> = (props) => {
    if(props.href.startsWith('#')){
        return JumpLink(props);
    }
    if (props.href.match(/^https?:\/\//)){
        return ExternalLink(props);
    }
    return InternalLink(props);
}

const LinkPreview : React.FC<{url: string}> = ({url}) => {
    let ele = defaultPopup;
    let format: Format;
    const { urlMeta } = useRouteData();
    if(urlMeta[url] == null){
        return null;
    }
    for(format in formats){
        if(formats[format].test(url)){
            ele = popups[format];
        }
    }
    if(urlMeta[url].title != null){
        return ele(url, urlMeta[url]);
    }
    return null;
}