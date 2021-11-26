import React, { useState } from 'react';
import './colors.scss';
import { singletonHook } from 'react-singleton-hook';

type ColorSchemes = 'default' | 'light' | 'dark';
let globalSetScheme = (scheme: ColorSchemes) : void => { throw new Error('you must useScheme before setting its state')};

const useColorScheme = singletonHook<ColorSchemes>('default', () => {
  const [scheme, setScheme] = useState<ColorSchemes>('default');
  globalSetScheme = setScheme;
  return scheme;
});


export const SchemeProvider: React.FC<{}> = ({children}) => {
    const [theme, setScheme] = useState<ColorSchemes>('default');
    globalSetScheme = setScheme;

    return (<scheme theme={theme}>{children}</scheme>);
}

export const ThemeSwitcher: React.FC<{}> = () => (<select value={useColorScheme()}>
    <ThemeSelector theme="default">Default</ThemeSelector>
    <ThemeSelector theme="light">Light</ThemeSelector>
    <ThemeSelector theme="dark">Dark</ThemeSelector>
</select>);

const ThemeSelector: React.FC<{theme: ColorSchemes}> = ({theme, children}) => (<option
    onSelect={setColorScheme(theme)} value={theme}>{children}</option>);

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'scheme': { theme: ColorSchemes; children: React.ReactNode | React.ReactNodeArray; }
        }
    }
}

export const setColorScheme = (theme: ColorSchemes) => () => globalSetScheme(theme);
