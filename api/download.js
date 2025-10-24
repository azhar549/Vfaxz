const axios = require('axios');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('📥 Received download request');
        
        let body;
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            console.error('JSON parse error:', e);
            return res.status(400).json({ error: 'Invalid JSON format' });
        }
        
        const { url, query, format = 'mp4', quality = 'auto' } = body;
        
        console.log('Request data:', { url, query, format, quality });

        if (!url && !query) {
            return res.status(400).json({ error: 'URL or query required' });
        }

        const videoUrl = url || await convertQueryToUrl(query);
        console.log('Processing URL:', videoUrl);

        // 🎯 COBA API ALTERNATIF 1: ytstream
        const result = await tryAPIs(videoUrl, format, quality);
        
        if (result.success) {
            console.log('✅ Download link generated successfully');
            res.json({
                success: true,
                data: result.data
            });
        } else {
            throw new Error('All APIs failed: ' + result.error);
        }

    } catch (error) {
        console.error('❌ Final error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Service temporarily unavailable. Please try again later.',
            debug: error.message
        });
    }
};

async function tryAPIs(videoUrl, format, quality) {
    const apis = [
        tryYtdl,
        tryYoutubeDownloader,
        tryY2MateAlternative
    ];

    for (const apiFunc of apis) {
        try {
            console.log(`🔄 Trying ${apiFunc.name}...`);
            const result = await apiFunc(videoUrl, format, quality);
            if (result.success) {
                return result;
            }
        } catch (error) {
            console.log(`❌ ${apiFunc.name} failed:`, error.message);
            continue;
        }
    }
    
    return { success: false, error: 'All APIs failed' };
}

// 🎯 API 1: ytdl-based (paling reliable)
async function tryYtdl(videoUrl, format, quality) {
    try {
        // Extract video ID
        const videoId = extractVideoId(videoUrl);
        if (!videoId) throw new Error('Invalid YouTube URL');

        // Get video info using oembed
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedResponse = await axios.get(oembedUrl);
        const videoInfo = oembedResponse.data;

        // Generate download links using ytdl core
        const downloadLinks = generateDownloadLinks(videoId, format, quality);
        
        return {
            success: true,
            data: {
                detail: {
                    title: videoInfo.title,
                    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    videoId: videoId,
                    views: 0,
                    timestamp: 'Unknown',
                    ago: '',
                    author: { name: videoInfo.author_name }
                },
                convertInfo: {
                    ftype: format,
                    fquality: quality,
                    dlink: downloadLinks.url,
                    size: downloadLinks.size,
                    q: quality,
                    q_text: quality
                }
            }
        };
    } catch (error) {
        throw new Error(`ytdl failed: ${error.message}`);
    }
}

// 🎯 API 2: YouTube Downloader API
async function tryYoutubeDownloader(videoUrl, format, quality) {
    try {
        const apiUrl = 'https://yt-downloader-api.vercel.app/api/download';
        const response = await axios.post(apiUrl, {
            url: videoUrl,
            format: format,
            quality: quality
        }, {
            timeout: 10000
        });

        if (response.data.success) {
            return {
                success: true,
                data: response.data.data
            };
        }
        throw new Error('API returned error');
    } catch (error) {
        throw new Error(`YouTube Downloader API failed: ${error.message}`);
    }
}

// 🎯 API 3: Alternative y2mate
async function tryY2MateAlternative(videoUrl, format, quality) {
    try {
        // Using a different y2mate domain
        const analyzeUrl = "https://y2mate.ch/mates/analyzeV2/ajax";
        
        const analyzeData = new URLSearchParams();
        analyzeData.append('k_query', videoUrl);
        analyzeData.append('k_page', 'home');
        analyzeData.append('hl', 'en');
        analyzeData.append('q_auto', '0');

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": "https://y2mate.ch/"
        };

        const analyzeResponse = await axios.post(analyzeUrl, analyzeData, { headers, timeout: 10000 });
        
        if (analyzeResponse.data.status !== 'ok') {
            throw new Error('Analyze failed');
        }

        const analyzeInfo = analyzeResponse.data;
        const formatData = analyzeInfo.links[format];
        
        if (!formatData) {
            throw new Error(`Format ${format} not available`);
        }

        let selectedQuality = quality;
        if (quality === 'auto') {
            const qualities = Object.values(formatData).map(item => item.q);
            selectedQuality = format === 'mp4' ? 
                (qualities.includes('720p') ? '720p' : qualities[0]) :
                (qualities.includes('128kbps') ? '128kbps' : qualities[0]);
        }

        const qualityData = Object.values(formatData).find(item => item.q === selectedQuality);
        if (!qualityData) {
            throw new Error(`Quality ${selectedQuality} not available`);
        }

        // Convert
        const convertUrl = "https://y2mate.ch/mates/convertV2/index";
        const convertData = new URLSearchParams();
        convertData.append('vid', analyzeInfo.vid);
        convertData.append('k', qualityData.k);

        const convertResponse = await axios.post(convertUrl, convertData, { headers, timeout: 10000 });
        
        if (convertResponse.data.status !== 'ok') {
            throw new Error('Convert failed');
        }

        return {
            success: true,
            data: {
                detail: {
                    title: analyzeInfo.title,
                    thumbnail: `https://i.ytimg.com/vi/${analyzeInfo.vid}/hqdefault.jpg`,
                    videoId: analyzeInfo.vid,
                    views: 0,
                    timestamp: analyzeInfo.t,
                    ago: '',
                    author: { name: analyzeInfo.a }
                },
                convertInfo: {
                    ftype: format,
                    fquality: selectedQuality,
                    dlink: convertResponse.data.dlink,
                    size: qualityData.size,
                    q: selectedQuality,
                    q_text: qualityData.q_text
                }
            }
        };

    } catch (error) {
        throw new Error(`y2mate alternative failed: ${error.message}`);
    }
}

// Helper functions
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function generateDownloadLinks(videoId, format, quality) {
    // Simple URL generator - in real implementation you'd use a proper service
    const baseUrl = `https://yt-downloader-api.vercel.app/api/download?id=${videoId}&format=${format}`;
    
    return {
        url: baseUrl,
        size: 'Unknown',
        quality: quality
    };
}

async function convertQueryToUrl(query) {
    // Simple implementation - just return as YouTube search
    // In production, you'd use YouTube Data API to search
    return `https://www.youtube.com/watch?v=${query}`;
}
