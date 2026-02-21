/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle ONNX Runtime for emotion recognition
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        url: false,
        querystring: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
      };
      
      // Ignore ONNX runtime files completely
      config.module.rules.push({
        test: /\.node$/,
        use: 'ignore-loader',
      });
      
      config.module.rules.push({
        test: /ort\.node\.min\./,
        use: 'ignore-loader',
      });
    }
    
    return config;
  },
}

module.exports = nextConfig
