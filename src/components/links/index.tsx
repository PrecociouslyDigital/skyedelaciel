import React from 'react';
export const JumpLink : React.FC<{to: string}>=({to, children}) => (
    <a href={to}>
        {children}
    </a>); 