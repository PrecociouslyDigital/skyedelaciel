import React from 'react';

type Resolvers = 'url';

const resolvers : { 
    [resolver in Resolvers]: (url: string, args?:{
        [key: string] : string;
    }) => string
} = {
    url: () => 'hi',
}

export const Citation: React.FC<{
    resolver: Resolvers,
    url: string,
    args: {
        [key: string] : string;
    }
}> = ({resolver, url, children, args}) => (<div>
    {resolver}<br></br>{url}<br></br>{children}
</div>);