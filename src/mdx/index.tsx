import { Code } from './code';
import { Image } from './img'; 
import { Blockquote } from './blockquote';
import { MDXProvider } from '@mdx-js/react'; 
import React from 'react';
import { useRouteData } from 'react-static';
import { Header } from './headers';
import { memoize } from 'lodash';
import { Bibliography, Citation } from 'components/cite';
import { HeaderData, TOC, Abstract, Title } from 'components/frontmatter';
import { Link } from 'components/links';
import { Footer } from 'components/footer';
import { Previews } from 'components/nav';

export const MarkdownProvider: React.FC<{}> = ({children}) => (
    <MDXProvider components={{
        a: Link,
        code: Code,
        img: Image,
        blockquote: Blockquote,
        wrapper: wrapper,
        h1: Header('h1'),
        h2: Header('h2'),
        h3: Header('h3'),
        h4: Header('h4'),
        h5: Header('h5'),
        Citation,
        Previews,
    }}>
        {children}
    </MDXProvider>
);

export const renderChildren = (children: React.ReactNode) => React.Children.map(
            children, child => renderChild(child)
            ).join('');

const renderChild = memoize((child: any): string => {
    if(typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
        return child.toString();
    }
    if(child.props != null && child.props.children != null){
        if(Array.isArray(child.props.children)){
            return child.props.children.map(renderChild).join('');
        }else{
            if(child.props.children.props != null){
                return renderChild(child.props.children);
            }
            
            return child.props.children.toString();
        }
    }
});


function addEleToTOC(headers: HeaderData, child: React.ReactElement): void{
    const hLevel = parseInt(child.props.mdxType.charAt(1));
    if(headers.length === 0){
        //We're the first!
        headers.push([[1], renderChild(child)])
    }
    // Walk from the back: What is our nearest sibling/ancestor's number?
    let ancestor = null;
    for(let i = headers.length - 1; i >= 0; i--){
        if(headers[i][0].length <= hLevel){
            ancestor = headers[i][0];
            break;
        }
    }
    
    let self = [...ancestor];
    // If we're a sibling; increment the number:
    if(ancestor.length === hLevel){
        self[self.length-1] += 1;
    }else{
        // This is our parent in some way. Time to add zeros!
        for(let i = ancestor.length; i < hLevel; i++){
            self[i] = 0;
        }
        self[hLevel-1] = 1
    }
    headers.push([self, renderChild(child)]);
}


const wrapper : React.FC<{}> = ({children}: {components: React.ReactChild, children: React.ReactNode} ) => {
    const headers: HeaderData = [];
    const {frontMatter, urlMeta } = useRouteData();
    console.log(useRouteData());
    React.Children.forEach(children, (child: any) => {
        if (
          child.props != null &&
          child.props.mdxType != null &&
          /h[1-5]/g.test(child.props.mdxType)
        ) {
          addEleToTOC(headers, child);
        }
    });
    return (
      <div>
        {frontMatter.title && <Title {...frontMatter} />}
        {headers.length > 0 && <TOC headers={headers} />}
        {frontMatter.abstract && (
          <Abstract content={frontMatter.abstract}></Abstract>
        )}
        {children}
        {frontMatter.noBib !== true && <Bibliography works={urlMeta} />}
        <Footer />
      </div>
    );
}