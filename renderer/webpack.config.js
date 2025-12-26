import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Determine if we're in development mode (webpack serve)
const isDevServer = process.argv.includes('serve') || process.argv.includes('webpack-dev-server');
const isDev = process.env.NODE_ENV === 'development';
export default {
    entry: path.resolve(__dirname, 'src/index.jsx'),
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        clean: true,
        // Use '/' for dev server, './' for production build
        publicPath: isDev ? '/' : './'
    },
    target: isDev ? 'web' : 'electron-renderer',
    node: {
        __dirname: false,
        __filename: false
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react']
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    cache: false, // Disable cache for development
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'index.html'),
            filename: 'index.html'
        }),
        // Replace webpack/hot/emitter.js with our stub that uses events package
        new webpack.NormalModuleReplacementPlugin(
            /^webpack\/hot\/emitter\.js$/,
            path.resolve(__dirname, 'src/node-stubs/emitter.js')
        ),
        // Provide EventEmitter from events package globally
        new webpack.ProvidePlugin({
            EventEmitter: ['events', 'EventEmitter']
        }),
        // Add require polyfill at the beginning of bundle for webpack-dev-server client
        new webpack.BannerPlugin({
            banner: 'if (typeof window !== "undefined" && typeof window.require === "undefined") { window.require = function() { return {}; }; }',
            raw: true,
            entryOnly: false
        })
    ],
    resolve: {
        extensions: ['.js', '.jsx'],
        alias: {
            "events": require.resolve("events")
        },
        fallback: {
            "https": false,
            "url": false,
            "buffer": false,
            "stream": false,
            "crypto": false,
            "events": require.resolve("events"),
            "util": false
        }
    },
    devServer: {
        port: 8080,
        hot: false, // Disable HMR to avoid require issues in Electron
        liveReload: true, // Enable live reload for automatic page refresh
        open: false, // Don't open browser automatically
        historyApiFallback: {
            index: '/index.html'
        },
        devMiddleware: {
            publicPath: '/',
            writeToDisk: false
        },
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        client: {
            webSocketURL: 'auto://0.0.0.0:0/ws',
            overlay: {
                errors: true,
                warnings: false
            }
        }
    }
};

