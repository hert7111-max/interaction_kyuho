import { defineConfig } from 'vite'
export default defineConfig({server:{host:'0.0.0.0',fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.certs/**','**/.dev-tools/**','**/*.key']}},build:{target:'es2020',minify:true,cssMinify:true,reportCompressedSize:false}})
