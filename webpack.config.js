import path from 'path';
import { fileURLToPath } from 'url';

export default {
  // メインとなるJavaScriptファイル（エントリーポイント）
  entry: {
    "script": `./src/main.ts`
  },

  // ファイルの出力設定
  output: {
    //  出力ファイルのディレクトリ名
    path: `${path.dirname(fileURLToPath(import.meta.url))}/public`,
    // 出力ファイル名
    filename: "[name].js"
  },

  module: {
    // node_modules由来のものを除くtsファイルに対してts-loaderを実行する
    rules:[{
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/
    }]
  },

  resolve: {
    // import文で拡張子を省略可能にする
    extensions: [".ts", ".js"],
    // .js でのインポートを .ts に読み替えさせる
    extensionAlias: {
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'] // mjsを使用している場合
    }
  },

  mode: "production"
};