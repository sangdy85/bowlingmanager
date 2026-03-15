const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        'bowlingmanager.co.kr', 
        'www.bowlingmanager.co.kr',
        'http://bowlingmanager.co.kr',
        'https://bowlingmanager.co.kr',
        'http://www.bowlingmanager.co.kr',
        'https://www.bowlingmanager.co.kr',
        'localhost:3000'
      ],
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
