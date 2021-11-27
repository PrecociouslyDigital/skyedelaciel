import React, { useState } from 'react';
import './colors.scss';

type ColorSchemes = 'default' | 'light' | 'dark';

export const ThemeSwitcher: React.FC<{}> = () => (<select>
    <ThemeSelector theme="default">Default</ThemeSelector>
    <ThemeSelector theme="light">Light</ThemeSelector>
    <ThemeSelector theme="dark">Dark</ThemeSelector>
</select>);

const ThemeSelector: React.FC<{theme: ColorSchemes}> = React.memo(({theme, children}) => (<option
    onSelect={setColorScheme(theme)} value={theme}>{children}</option>));

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'scheme': { theme: ColorSchemes; children: React.ReactNode | React.ReactNodeArray; }
        }
    }
}

export const setColorScheme = (theme: ColorSchemes) => () => document.body.style.setProperty('theme',theme);
