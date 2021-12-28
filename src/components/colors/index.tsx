import React, { ChangeEvent, ChangeEventHandler } from 'react';
import './colors.scss';

type ColorSchemes = 'default' | 'light' | 'dark';

export const ThemeSwitcher: React.FC<{}> = () => (<select value={document.body.getAttribute("theme")} onChange={setColorScheme}>
    <option value="default">Default</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
</select>);

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'scheme': { theme: ColorSchemes; children: React.ReactNode | React.ReactNodeArray; }
        }
    }
}

export const setColorScheme : ChangeEventHandler = (e: any) => {
    document.body.setAttribute("theme", e.target.value);
}
