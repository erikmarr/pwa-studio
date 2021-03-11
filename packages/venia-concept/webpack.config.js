const { configureWebpack, graphQL } = require('@magento/pwa-buildpack');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const {
    getMediaURL,
    getStoreConfigData,
    getAvailableStoresConfigData,
    getPossibleTypes
} = graphQL;

const { DefinePlugin } = webpack;
const { LimitChunkCountPlugin } = webpack.optimize;

module.exports = async env => {
    /**
     * configureWebpack() returns a regular Webpack configuration object.
     * You can customize the build by mutating the object here, as in
     * this example. Since it's a regular Webpack configuration, the object
     * supports the `module.noParse` option in Webpack, documented here:
     * https://webpack.js.org/configuration/module/#modulenoparse
     */
    const config = await configureWebpack({
        context: __dirname,
        vendor: [
            '@apollo/client',
            'apollo-cache-persist',
            'informed',
            'react',
            'react-dom',
            'react-feather',
            'react-redux',
            'react-router-dom',
            'redux',
            'redux-actions',
            'redux-thunk'
        ],
        special: {
            'react-feather': {
                esModules: true
            }
        },
        env
    });

    const mediaUrl = await getMediaURL();
    const storeConfigData = await getStoreConfigData();
    const { availableStores } = await getAvailableStoresConfigData();

    global.MAGENTO_MEDIA_BACKEND_URL = mediaUrl;
    global.LOCALE = storeConfigData.locale.replace('_', '-');
    global.AVAILABLE_STORE_VIEWS = availableStores;

    const possibleTypes = await getPossibleTypes();

    config.module.noParse = [
        /@adobe\/adobe\-client\-data\-layer/,
        /braintree\-web\-drop\-in/
    ];
    config.plugins = [
        ...config.plugins,
        new DefinePlugin({
            /**
             * Make sure to add the same constants to
             * the globals object in jest.config.js.
             */
            POSSIBLE_TYPES: JSON.stringify(possibleTypes),
            STORE_NAME: JSON.stringify('Venia'),
            STORE_VIEW_CODE: process.env.STORE_VIEW_CODE
                ? JSON.stringify(process.env.STORE_VIEW_CODE)
                : JSON.stringify(storeConfigData.code),
            AVAILABLE_STORE_VIEWS: JSON.stringify(availableStores),
            DEFAULT_LOCALE: JSON.stringify(global.LOCALE)
        }),
        new HTMLWebpackPlugin({
            filename: 'index.html',
            template: './template.html',
            minify: {
                collapseWhitespace: true,
                removeComments: true
            }
        })
    ];

    const serverConfig = Object.assign({}, config, {
        target: 'node',
        output: {
            ...config.output,
            filename: '[name].[contenthash].SERVER.js',
            strictModuleExceptionHandling: true,
            chunkFilename: '[name].[chunkhash].SERVER.js'
        },
        devtool: false,
        optimization: {
            minimize: false
        }
    });

    // remove HtmlWebpackPlugin
    serverConfig.plugins.pop();
    // remove LocalizationPlugin for now, having problems with InjectPlugin
    serverConfig.plugins.splice(6, 1);
    // replace ServiceWorkerPlugin with LimitChunkCountPlugin
    serverConfig.plugins[5] = new LimitChunkCountPlugin({
        maxChunks: 1
    });

    return [config, serverConfig];
};
