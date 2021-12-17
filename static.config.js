import path from 'path';
import {doRoutePreprocess} from './plugins'

require('dotenv');



// Typescript support in static.config.js is not yet supported, but is coming in a future update!

export default {
    entry: path.join(__dirname, 'src', 'index.tsx'),
    getRoutes: async () => {
        return [
        ]
    },
    plugins: [
        'react-static-plugin-typescript',
        [
            require.resolve('react-static-plugin-source-filesystem'),
            {
                location: path.resolve('./src/pages'),
                createRoute: (data) => ({
                    getData: doRoutePreprocess(data),
                    ...data,
                }),
            },
        ],
        require.resolve('react-static-plugin-reach-router'),
        require.resolve('react-static-plugin-sass'),
        require.resolve('react-static-plugin-sitemap'),
        [
            require.resolve('react-static-plugin-mdx'),
            {
                parseFrontMatter: true,
            }
        ],
        [
            require.resolve('react-static-plugin-css-modules'),
            {
                 modules: true, // set true by default
                 localIdentName: '[path][name]__[local]--[hash:base64:5]', // just an example
                 // any other options you wish from css-loader
                 // want to use sass? you can track it down in your webpack build and add the loader
                 // otherwise open an issue tagging @ScriptedAlchemy. He will enhance the options if required 
             }
        ],
    ],
}


