const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const YouTubeDownloader = require('../config/YouTubeDownloader');
const { spawn } = require('child_process');

const router = express.Router();

// Mapa de downloads ativos
const activeDownloads = new Map();

// POST /api/downloadyoutube/info - Obter informações do vídeo
router.post('/info', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL é obrigatória'
      });
    }

    if (!YouTubeDownloader.validateYouTubeUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL deve ser um vídeo válido do YouTube'
      });
    }

    const videoInfo = await YouTubeDownloader.getVideoInfo(url);
    
    res.json({
      success: true,
      video_info: videoInfo
    });

  } catch (error) {
    console.error('Erro ao obter informações do vídeo:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Erro ao obter informações do vídeo'
    });
  }
});

// POST /api/downloadyoutube - Download de vídeo do YouTube
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { url, id_pasta, quality, format } = req.body;
    const userId = req.user.id;

    if (!url || !id_pasta) {
      return res.status(400).json({ 
        success: false,
        error: 'URL e pasta são obrigatórios' 
      });
        success: false,
        error: 'URL e pasta são obrigatórios' 
      });
    }

    if (!YouTubeDownloader.validateYouTubeUrl(url)) {
      return res.status(400).json({ 
        success: false,
        error: 'URL deve ser um vídeo válido do YouTube' 
      });
        success: false,
        error: 'URL deve ser um vídeo válido do YouTube' 
      });
    }

    // Verificar se download já está em andamento
    if (activeDownloads.has(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um download em andamento. Aguarde a conclusão.'
      });
    }

    // Verificar se já existe download ativo
    const currentStatus = YouTubeDownloader.getDownloadStatus(userId);
    if (currentStatus.downloading) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um download em andamento. Aguarde a conclusão.'
      });
        success: false,
        error: 'Pasta não encontrada' 
      });
    }

    const folderData = folderRows[0];
    const folderName = folderData.identificacao;
    const serverId = folderData.codigo_servidor || 1;

    // Verificar espaço disponível
    const availableSpace = folderData.espaco - folderData.espaco_usado;
    if (availableSpace < 100) { // Mínimo 100MB para download
      return res.status(400).json({
        success: false,
        error: `Espaço insuficiente. Disponível: ${availableSpace}MB. Mínimo necessário: 100MB.`
      });
    }

    try {
      // Garantir que o diretório do usuário existe no servidor
      await SSHManager.createCompleteUserStructure(serverId, userLogin, {
        bitrate: req.user.bitrate || 2500,
        espectadores: req.user.espectadores || 100,
        status_gravando: 'nao',
        senha_transmissao: 'teste2025'
      });
      
      await SSHManager.createUserFolder(serverId, userLogin, folderName);

      // Obter informações do vídeo primeiro
      console.log(`📹 Obtendo informações do vídeo: ${url}`);
      
      const infoProcess = spawn('yt-dlp', [
        '--print-json',
        '--no-download',
        '--format', 'best[ext=mp4]/best',
        url
      ]);

      let infoOutput = '';
      let infoError = '';

      infoProcess.stdout.on('data', (data) => {
        infoOutput += data.toString();
      });

      infoProcess.stderr.on('data', (data) => {
        infoError += data.toString();
      });

      const videoInfo = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          infoProcess.kill();
          reject(new Error('Timeout ao obter informações do vídeo'));
        }, 30000);

        infoProcess.on('close', (code) => {
          clearTimeout(timeout);
          
          if (code === 0 && infoOutput) {
            try {
              const info = JSON.parse(infoOutput.trim());
              resolve({
                title: info.title || 'Video do YouTube',
                duration: info.duration || 0,
                filesize: info.filesize || info.filesize_approx || 0,
                ext: info.ext || 'mp4',
                id: info.id || 'unknown'
              });
            } catch (parseError) {
              reject(new Error('Erro ao analisar informações do vídeo'));
            }
          } else {
            const errorMsg = infoError.includes('Video unavailable') ? 'Vídeo não disponível ou privado' :
                           infoError.includes('Sign in to confirm') ? 'Vídeo requer confirmação de idade' :
                           infoError.includes('This video is not available') ? 'Vídeo não disponível na sua região' :
                           'Erro ao acessar vídeo do YouTube';
            reject(new Error(errorMsg));
          }
        });

        infoProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Erro no yt-dlp: ${error.message}`));
        });
      });

      console.log(`📋 Informações do vídeo obtidas:`, videoInfo);

      // Verificar se o arquivo não é muito grande
      const estimatedSizeMB = Math.ceil((videoInfo.filesize || 50 * 1024 * 1024) / (1024 * 1024));
      if (estimatedSizeMB > availableSpace) {
        return res.status(400).json({
          success: false,
          error: `Arquivo muito grande (${estimatedSizeMB}MB). Espaço disponível: ${availableSpace}MB.`
        });
      }

      // Sanitizar nome do arquivo
      const sanitizedTitle = videoInfo.title
        .replace(/[^a-zA-Z0-9\s\-_]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
      
      const fileName = `${sanitizedTitle}_${videoInfo.id}.mp4`;
      const tempFilePath = `/tmp/${fileName}`;
      const remotePath = `/home/streaming/${userLogin}/${folderName}/${fileName}`;

      // Marcar download como ativo
      activeDownloads.set(userId, {
        url,
        fileName,
        startTime: new Date(),
        status: 'downloading'
      });

      // Responder imediatamente que o download foi iniciado
      res.json({
        success: true,
        message: `Download iniciado: "${videoInfo.title}"`,
        video_info: {
          title: videoInfo.title,
          duration: videoInfo.duration,
          estimated_size_mb: estimatedSizeMB,
          filename: fileName
        },
        download_id: `${userId}_${Date.now()}`
      });

      // Continuar download em background
      console.log(`⬇️ Iniciando download: ${videoInfo.title}`);

      const downloadProcess = spawn('yt-dlp', [
        '--format', 'best[ext=mp4]/best',
        '--output', tempFilePath,
        '--no-playlist',
        '--extract-flat', 'false',
        '--write-info-json',
        '--write-thumbnail',
        url
      ]);

      let downloadOutput = '';
      let downloadError = '';

      downloadProcess.stdout.on('data', (data) => {
        const output = data.toString();
        downloadOutput += output;
        
        // Log de progresso
        if (output.includes('%')) {
          console.log(`📊 Download progress: ${output.trim()}`);
        }
      });

      downloadProcess.stderr.on('data', (data) => {
        downloadError += data.toString();
      });

      downloadProcess.on('close', async (code) => {
        try {
          if (code === 0) {
            console.log(`✅ Download concluído: ${fileName}`);
            
            // Verificar se arquivo foi criado
            const stats = await fs.stat(tempFilePath);
            const fileSizeMB = Math.ceil(stats.size / (1024 * 1024));
            
            // Upload para o servidor via SSH
            await SSHManager.uploadFile(serverId, tempFilePath, remotePath);
    // Iniciar download
    const result = await YouTubeDownloader.downloadVideo(userId, url, id_pasta, {
      quality: quality || 'best[height<=1080]',
      format: format || 'mp4'
    });

    res.json({
      success: true,
      message: `Download iniciado: "${result.video_info.title}"`,
      download_id: result.download_id,
      video_info: result.video_info,
      estimated_size_mb: result.estimated_size_mb
    });

  } catch (error) {
    console.error('Erro no download do YouTube:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Erro no download do YouTube'
    });
  }
});

// GET /api/downloadyoutube/status - Verificar status de downloads
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = YouTubeDownloader.getDownloadStatus(userId);
    
    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Erro ao verificar status de download:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/downloadyoutube/cancel - Cancelar download
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await YouTubeDownloader.cancelDownload(userId);
    
    res.json(result);

  } catch (error) {
    console.error('Erro ao cancelar download:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/downloadyoutube/recent - Downloads recentes
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    const recentDownloads = await YouTubeDownloader.getRecentDownloads(userId, limit);
    
    res.json({
      success: true,
      downloads: recentDownloads
    });

  } catch (error) {
    console.error('Erro ao obter downloads recentes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/downloadyoutube/validate - Validar URL do YouTube
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.json({
        valid: false,
        message: 'URL é obrigatória'
      });


    const isValid = YouTubeDownloader.validateYouTubeUrl(url);
    
    if (!isValid) {
      return res.json({
        valid: false,
        message: 'URL deve ser um vídeo válido do YouTube'
      });
    }

    try {
      // Tentar obter informações básicas para validar se vídeo existe
      const videoInfo = await YouTubeDownloader.getVideoInfo(url);
      
      res.json({
        valid: true,
        message: 'URL válida e vídeo acessível',
        video_info: {
          title: videoInfo.title,
          duration: videoInfo.duration,
          uploader: videoInfo.uploader
        }
      });
    } catch (infoError) {
      res.json({
        valid: false,
        message: infoError.message || 'Vídeo não acessível'
      });
    }

  } catch (error) {
    console.error('Erro ao validar URL:', error);
    res.status(500).json({
      valid: false,
      message: 'Erro interno do servidor'
    });
      success: false,
      error: 'Erro no download do YouTube', 
      details: err.message 
    });
  }
});

// GET /api/downloadyoutube/status - Verificar status de downloads
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const activeDownload = activeDownloads.get(userId);
    
    if (!activeDownload) {
      return res.json({
        success: true,
        downloading: false,
        status: 'idle'
      });
    }

    const uptime = Math.floor((new Date().getTime() - activeDownload.startTime.getTime()) / 1000);
    
    res.json({
      success: true,
      downloading: true,
      status: activeDownload.status,
      filename: activeDownload.fileName,
      uptime: uptime,
      url: activeDownload.url
    });

  } catch (error) {
    console.error('Erro ao verificar status de download:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/downloadyoutube/cancel - Cancelar download
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const activeDownload = activeDownloads.get(userId);
    
    if (!activeDownload) {
      return res.json({
        success: true,
        message: 'Nenhum download ativo encontrado'
      });
    }

    // Remover do mapa
    activeDownloads.delete(userId);
    
    res.json({
      success: true,
      message: 'Download cancelado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao cancelar download:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;