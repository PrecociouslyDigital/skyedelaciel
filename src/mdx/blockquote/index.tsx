import React from 'react';
import './blockquote.scss';

export const Blockquote: React.FC<{}> =
    ({children}) => (<blockquote>{children}</blockquote>);