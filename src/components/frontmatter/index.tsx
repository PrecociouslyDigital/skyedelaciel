import React, { ReactNode } from 'react';
import Markdown from 'markdown-to-jsx';
import { JumpLink } from 'components/links';
import './frontmatter.scss';
import { slugfy } from 'mdx/headers';
// We compose this stuff further up, in the wrapper usually

export const Title: React.FC<{
    title: ReactNode,
    subtitle?: ReactNode,
    author?: ReactNode,
    datePublished?: string,
    dateUpdated?: string,
}> = ({title, subtitle, author, datePublished, dateUpdated}) => (<div className="header">
    <h1>{title}</h1>
    {subtitle && <h2>{subtitle}</h2>}
    {author && <p>By: {author}</p>}
    {datePublished  && <p>
        <span>Date Published: {datePublished}</span> 
        {dateUpdated && <span>; Date Updated: {dateUpdated}</span>}
    </p>}
</div>)

export const Abstract: React.FC<{
    content: string,
}> =({content}) => <div className="abstract"><h5>Abstract</h5><Markdown>{content}</Markdown></div>

export type HeaderData = [number[], string][];

export const TOC: React.FC<{headers: HeaderData}> = ({headers})=> <ul className="toc">
    <h5>Table of Contents</h5>
    {headers.map(([header, content]) => <li className={`h${header.length}`}>
            <JumpLink to={`#${slugfy(content)}`}><span>{header.join('.')}.</span> <span>{content}</span></JumpLink>
        </li>)}
</ul>