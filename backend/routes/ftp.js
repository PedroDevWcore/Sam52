const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const FTPManager = require('../config/FTPManager');
const SSHManager = require('../config/SSHManager');
const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('basic-ftp');

const router = express.Router();

// Mapa de conexões FTP ativas
const activeFTPConnections = new Map();
const activeMigrations = new Map();
    const { ip, usuario, senha, porta = 21 } = req.body;
    const userId = req.user.id;
// POST /api/ftp/connect - Conecta ao FTP
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    const { ip, usuario, senha, porta = 21 } = req.body;
    const userId = req.user.id;

    if (!ip || !usuario || !senha) {
      return res.status(400).json({
        success: false,
        error: 'IP, usuário e senha são obrigatórios'
      });
    }

    // Conectar usando FTPManager
    await FTPManager.connect(userId, { ip, usuario, senha, porta });
    
    // Listar diretório raiz
    const result = await FTPManager.listDirectory(userId, '/');
        user: usuario,
        password: senha,
        secure: false
      });

      console.log(`✅ Conectado ao FTP com sucesso`);

      // Listar arquivos do diretório raiz
      const fileList = await client.list('/');
      
      // Processar lista de arquivos
      const files = fileList.map(file => {
        const isVideo = file.type === 1 && /\.(mp4|avi|mov|wmv|flv|webm|mkv|3gp|ts|mpg|mpeg|ogv|m4v)$/i.test(file.name);
        
        return {
          name: file.name,
          type: file.type === 2 ? 'directory' : 'file',
          path: `/${file.name}`,
          size: file.size || 0,
          isVideo: isVideo,
          modifiedAt: file.modifiedAt || new Date(),
          permissions: file.permissions || 0
        };
      });

      // Salvar conexão ativa
      activeFTPConnections.set(userId, {
        client: client,
        connectionData: { ip, usuario, senha, porta },
        connectedAt: new Date(),
        currentPath: '/'
      });

      // Fechar conexão (será reaberta quando necessário)
      client.close();

      res.json({
        success: true,
        files: files,
        currentPath: '/',
        message: 'Conectado ao FTP com sucesso'
      });

    } catch (ftpError) {
      console.error('❌ Erro na conexão FTP:', ftpError);
      
      let errorMessage = 'Erro ao conectar ao servidor FTP';
      
      if (ftpError.code === 'ECONNREFUSED') {
        errorMessage = 'Conexão recusada. Verifique IP e porta.';
      } else if (ftpError.code === 'ENOTFOUND') {
        errorMessage = 'Servidor não encontrado. Verifique o IP.';
      } else if (ftpError.code === 530) {
        errorMessage = 'Usuário ou senha incorretos.';
      } else if (ftpError.code === 'ETIMEDOUT') {
        errorMessage = 'Timeout na conexão. Servidor pode estar offline.';
      }

      res.status(400).json({
        success: false,
        error: errorMessage,
      files: result.files,
      currentPath: result.currentPath,
      video_count: result.videoCount,
      message: 'Conectado ao FTP com sucesso'
    }

  } catch (error) {
    console.error('Erro ao conectar FTP:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao conectar ao servidor FTP'
    });
  }
});

// POST /api/ftp/list - Lista arquivos de um diretório
router.post('/list', authMiddleware, async (req, res) => {
  try {
    const { path } = req.body;
    const userId = req.user.id;
    const userId = req.user.id;

    const connectionData = activeFTPConnections.get(userId);
    if (!connectionData) {
      return res.status(400).json({
        success: false,
        error: 'Conexão FTP não encontrada. Conecte-se novamente.'
      });
    }

    console.log(`📁 Listando diretório FTP: ${directoryPath}`);

    try {
      const client = new Client();
      client.ftp.timeout = 30000;

      // Reconectar
      await client.access(connectionData.connectionData);

      // Listar arquivos do diretório especificado
      const fileList = await client.list(directoryPath);
      
      // Processar lista de arquivos
      const files = fileList.map(file => {
        const fullPath = path.posix.join(directoryPath, file.name);
        const isVideo = file.type === 1 && /\.(mp4|avi|mov|wmv|flv|webm|mkv|3gp|ts|mpg|mpeg|ogv|m4v)$/i.test(file.name);
        
        return {
          name: file.name,
          type: file.type === 2 ? 'directory' : 'file',
          path: fullPath,
          size: file.size || 0,
          isVideo: isVideo,
          modifiedAt: file.modifiedAt || new Date(),
          permissions: file.permissions || 0
        };
      });

      // Adicionar entrada para diretório pai (se não for raiz)
      if (directoryPath !== '/') {
        const parentPath = path.posix.dirname(directoryPath);
        files.unshift({
          name: '..',
          type: 'directory',
          path: parentPath,
          size: 0,
          isVideo: false,
          modifiedAt: new Date(),
          permissions: 0
        });
      }

      client.close();

      // Atualizar caminho atual
      activeFTPConnections.set(userId, {
        ...connectionData,
        currentPath: directoryPath
      });

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Caminho é obrigatório'
      });
    }

    const result = await FTPManager.listDirectory(userId, path);
      res.status(400).json({
        success: false,
        error: 'Erro ao acessar diretório',
      files: result.files,
      currentPath: result.currentPath,
      video_count: result.videoCount
    }

  } catch (error) {
    console.error('Erro ao listar diretório:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar diretório'
    });
  }
});

// POST /api/ftp/scan-directory - Escaneia diretório recursivamente
router.post('/scan-directory', authMiddleware, async (req, res) => {
  try {
    const { directoryPath } = req.body;
    const userId = req.user.id;
    const userId = req.user.id;

    const connectionData = activeFTPConnections.get(userId);
    if (!connectionData) {
      return res.status(400).json({
        success: false,
        error: 'Conexão FTP não encontrada. Conecte-se novamente.'
      });
    }

    console.log(`🔍 Escaneando diretório recursivamente: ${directoryPath}`);

    try {
      const client = new Client();
      client.ftp.timeout = 60000; // Timeout maior para scan recursivo

      await client.access(connectionData.connectionData);

      const videos = [];
      
      // Função recursiva para escanear diretórios
      const scanDirectory = async (currentPath) => {
        try {
          const fileList = await client.list(currentPath);
          
          for (const file of fileList) {
            const fullPath = path.posix.join(currentPath, file.name);
            
            if (file.type === 2) { // Diretório
              // Evitar loops infinitos
              if (file.name !== '.' && file.name !== '..') {
                await scanDirectory(fullPath);
              }
            } else if (file.type === 1) { // Arquivo
              const isVideo = /\.(mp4|avi|mov|wmv|flv|webm|mkv|3gp|ts|mpg|mpeg|ogv|m4v)$/i.test(file.name);
              
              if (isVideo) {
                videos.push({
                  name: file.name,
                  path: fullPath,
                  size: file.size || 0,
                  directory: currentPath,
                  modifiedAt: file.modifiedAt || new Date()
                });
              }
            }
          }
        } catch (dirError) {
    if (!directoryPath) {
      return res.status(400).json({
        success: false,
        error: 'Caminho do diretório é obrigatório'
      });
    }

    const result = await FTPManager.scanDirectoryRecursive(userId, directoryPath);
        success: false,
        error: 'Erro ao escanear diretório',
        details: ftpError.message
      videos: result.videos,
      total_videos: result.total_videos,
      scanned_directories: result.scanned_directories,
      scanned_directory: directoryPath
    }

  } catch (error) {
    console.error('Erro ao escanear diretório:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao escanear diretório'
    });
  }
});

// POST /api/ftp/migrate - Migra arquivos do FTP
router.post('/migrate', authMiddleware, async (req, res) => {
  try {
    const { files, destinationFolder } = req.body;
    const userId = req.user.id;
    const userLogin = req.user.email ? req.user.email.split('@')[0] : `user_${userId}`;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo selecionado'
      });
    }

    if (!destinationFolder) {
      return res.status(400).json({
        success: false,
        error: 'Pasta de destino é obrigatória'
      });
    }

    // Verificar se já existe migração ativa
    if (activeMigrations.has(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Já existe uma migração em andamento. Aguarde a conclusão.'
      });
    }

    const connectionData = activeFTPConnections.get(userId);
    if (!connectionData) {
      return res.status(400).json({
        success: false,
        error: 'Conexão FTP não encontrada. Conecte-se novamente.'
      });
    }

    // Buscar dados da pasta de destino
    const [folderRows] = await db.execute(
      'SELECT identificacao, codigo_servidor, espaco, espaco_usado FROM streamings WHERE codigo = ? AND codigo_cliente = ?',
      [destinationFolder, userId]
    );

    if (folderRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pasta de destino não encontrada'
      });
    }

    const folderData = folderRows[0];
    const folderName = folderData.identificacao;
    const serverId = folderData.codigo_servidor || 1;

    // Verificar espaço disponível
    const availableSpace = folderData.espaco - folderData.espaco_usado;
    const estimatedTotalSize = files.length * 50; // Estimativa de 50MB por arquivo

    if (estimatedTotalSize > availableSpace) {
      return res.status(400).json({
        success: false,
        error: `Espaço insuficiente. Necessário: ~${estimatedTotalSize}MB, Disponível: ${availableSpace}MB`
      });
    }

    // Marcar migração como ativa
    activeMigrations.set(userId, {
      files: files,
      startTime: new Date(),
      status: 'migrating',
      completed: 0,
      errors: []
    });

    // Responder imediatamente
    res.json({
      success: true,
      message: `Migração iniciada para ${files.length} arquivo(s)`,
      migration_id: `${userId}_${Date.now()}`,
      estimated_time: `${Math.ceil(files.length * 2)} minutos`
    });

    // Continuar migração em background
    console.log(`🚀 Iniciando migração de ${files.length} arquivos para ${folderName}`);

    try {
      // Garantir que estrutura do usuário existe
      await SSHManager.createCompleteUserStructure(serverId, userLogin, {
        bitrate: req.user.bitrate || 2500,
        espectadores: req.user.espectadores || 100,
        status_gravando: 'nao',
        senha_transmissao: 'teste2025'
      });
      
      await SSHManager.createUserFolder(serverId, userLogin, folderName);

      const client = new Client();
      client.ftp.timeout = 120000; // 2 minutos timeout para downloads

      await client.access(connectionData.connectionData);

      let migratedFiles = 0;
      let totalSize = 0;
      const errors = [];

      for (const filePath of files) {
        try {
          console.log(`📥 Migrando arquivo: ${filePath}`);
          
          const fileName = path.basename(filePath);
          const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
          const tempFilePath = `/tmp/ftp_${userId}_${Date.now()}_${sanitizedFileName}`;
          const remotePath = `/home/streaming/${userLogin}/${folderName}/${sanitizedFileName}`;

          // Download do arquivo via FTP
          await client.downloadTo(tempFilePath, filePath);
          
          // Verificar se arquivo foi baixado
          const stats = await fs.stat(tempFilePath);
          const fileSizeMB = Math.ceil(stats.size / (1024 * 1024));
          
          console.log(`📊 Arquivo baixado: ${sanitizedFileName} (${fileSizeMB}MB)`);

          // Upload para servidor via SSH
          await SSHManager.uploadFile(serverId, tempFilePath, remotePath);
          
          // Remover arquivo temporário
          await fs.unlink(tempFilePath);
          
          console.log(`📤 Arquivo enviado para servidor: ${remotePath}`);

          // Salvar no banco de dados
          const relativePath = `streaming/${userLogin}/${folderName}/${sanitizedFileName}`;
          
          await db.execute(
            `INSERT INTO videos (
              nome, url, caminho, duracao, tamanho_arquivo,
              codigo_cliente, pasta, bitrate_video, formato_original,
              largura, altura, is_mp4, compativel, origem
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1920, 1080, ?, 'sim', 'ftp')`,
            [
              fileName,
              relativePath,
              remotePath,
              0, // Duração será calculada depois
              stats.size,
              userId,
              destinationFolder,
              2500, // Bitrate padrão
              path.extname(fileName).substring(1),
              path.extname(fileName).toLowerCase() === '.mp4' ? 1 : 0
            ]
          );

          migratedFiles++;
          totalSize += fileSizeMB;
          
          // Atualizar progresso
          const migrationData = activeMigrations.get(userId);
          if (migrationData) {
            migrationData.completed = migratedFiles;
            activeMigrations.set(userId, migrationData);
          }

          console.log(`✅ Arquivo migrado com sucesso: ${fileName}`);

        } catch (fileError) {
          console.error(`❌ Erro ao migrar ${filePath}:`, fileError);
          errors.push(`Erro ao migrar ${path.basename(filePath)}: ${fileError.message}`);
        }
      }

      client.close();

      // Atualizar espaço usado na pasta
    if (!destinationFolder) {
      return res.status(400).json({
        success: false,
        error: 'Pasta de destino é obrigatória'
      });
      
      const migrationData = activeMigrations.get(userId);
    // Iniciar migração
    const result = await FTPManager.migrateFiles(userId, files, destinationFolder);

      if (migrationData) {
        migrationData.status = 'error';
      message: result.message,
      migration_id: result.migration_id,
      total_files: files.length,
      estimated_time: result.estimated_time
    });

  } catch (error) {
    console.error('Erro na migração:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro durante a migração'
    });
  }
});

// GET /api/ftp/migration-status - Verificar status da migração
router.get('/migration-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = FTPManager.getMigrationStatus(userId);
    
    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Erro ao verificar status de migração:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/ftp/cancel-migration - Cancelar migração
router.post('/cancel-migration', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await FTPManager.cancelMigration(userId);
    
    res.json(result);

  } catch (error) {
    console.error('Erro ao cancelar migração:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/ftp/disconnect - Desconectar FTP
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await FTPManager.disconnect(userId);
    
    res.json(result);

  } catch (error) {
    console.error('Erro ao desconectar FTP:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao desconectar do FTP'
    }
  }
});

// GET /api/ftp/connection-status - Verificar status da conexão
router.get('/connection-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const connectionInfo = FTPManager.activeConnections.get(userId);
    
    res.json({
      success: true,
      connected: !!connectionInfo,
      connection_time: connectionInfo ? connectionInfo.connectedAt : null,
      last_used: connectionInfo ? connectionInfo.lastUsed : null
    });

  } catch (error) {
    console.error('Erro ao verificar status da conexão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/ftp/migration-status - Verificar status da migração
router.get('/migration-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const migrationData = activeMigrations.get(userId);
    
    if (!migrationData) {
      return res.json({
        success: true,
        migrating: false,
        status: 'idle'
      });
    }

    const uptime = Math.floor((new Date().getTime() - migrationData.startTime.getTime()) / 1000);
    const progress = migrationData.files.length > 0 ? 
      Math.round((migrationData.completed / migrationData.files.length) * 100) : 0;
    
    res.json({
      success: true,
      migrating: migrationData.status === 'migrating',
      status: migrationData.status,
      progress: progress,
      completed: migrationData.completed,
      total: migrationData.files.length,
      errors: migrationData.errors || [],
      uptime: uptime,
      total_size: migrationData.totalSize || 0
    });

  } catch (error) {
    console.error('Erro ao verificar status de migração:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/ftp/disconnect - Desconectar FTP
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Remover conexão ativa
    const connectionData = activeFTPConnections.get(userId);
    if (connectionData && connectionData.client) {
      try {
        connectionData.client.close();
      } catch (error) {
        // Ignorar erros ao fechar conexão
      }
    }
    
    activeFTPConnections.delete(userId);
    
    res.json({
      success: true,
      message: 'Desconectado do FTP'
    });

  } catch (error) {
    console.error('Erro ao desconectar FTP:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/ftp/cancel-migration - Cancelar migração
router.post('/cancel-migration', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const migrationData = activeMigrations.get(userId);
    
    if (!migrationData) {
      return res.json({
        success: true,
        message: 'Nenhuma migração ativa encontrada'
      });
    }

    // Marcar como cancelada
    migrationData.status = 'cancelled';
    activeMigrations.set(userId, migrationData);
    
    res.json({
      success: true,
      message: 'Migração cancelada'
    });

  } catch (error) {
    console.error('Erro ao cancelar migração:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Cleanup de conexões antigas
setInterval(() => {
  const now = new Date();
  const maxAge = 30 * 60 * 1000; // 30 minutos

  for (const [userId, connectionData] of activeFTPConnections) {
    if (now.getTime() - connectionData.connectedAt.getTime() > maxAge) {
      try {
        if (connectionData.client) {
          connectionData.client.close();
        }
      } catch (error) {
        // Ignorar erros
      }
      activeFTPConnections.delete(userId);
      console.log(`🧹 Conexão FTP expirada removida para usuário ${userId}`);
    }
  }

  // Limpar migrações antigas
  for (const [userId, migrationData] of activeMigrations) {
    if (now.getTime() - migrationData.startTime.getTime() > maxAge) {
      activeMigrations.delete(userId);
      error: 'Erro interno do servidor'
    }
  }
}, 10 * 60 * 1000); // A cada 10 minutos

module.exports = router;