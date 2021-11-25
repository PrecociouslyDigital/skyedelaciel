import React from 'react';
import './img.scss';

export const Image: React.FC<{src: string, alt:string, title:string}> =
    ({src, alt, title}) => (<figure>
        <img src={src} alt={title}/>
        <figcaption>{alt}</figcaption>
   </figure>)