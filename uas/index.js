require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
// Mengizinkan server menyajikan file statis (HTML/CSS/JS)
app.use(express.static('public'));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: true }
});

// Route: Ambil Berita (dengan filter ketat agar tidak ada bola/olahraga)
app.get('/api/news', async (req, res) => {
  const cat = req.query.category || 'home';
  const queries = {
    trending: '(\"K-pop\" OR \"film\" OR \"musik\" OR \"selebriti\") -bola -olahraga -nonton',
    movies: '(\"film\" OR \"k-drama\" OR \"bioskop\" OR \"aktor\" OR \"aktris\") -bola',
    music: '(\"k-pop\" OR \"musik\" OR \"penyanyi\" OR \"konser\" OR \"album\") -bola',
    home: '(\"film\" OR \"musik\" OR \"selebriti\" OR \"K-pop\") -bola'
  };

  try {
    const response = await axios.get(`https://newsapi.org/v2/everything`, {
      params: { 
        q: queries[cat] || queries.home, 
        language: 'id', 
        sortBy: 'publishedAt', 
        apiKey: process.env.NEWSAPI_KEY 
      }
    });
    res.json(response.data.articles);
  } catch (err) { 
    console.error('News fetch error:', err.message);
    res.status(500).json({ error: 'Gagal memuat berita' }); 
  }
});

// CRUD Koleksi

// POST: Simpan berita ke bookmark (dengan cek duplikat)
app.post('/api/save', (req, res) => {
  const { title, url, url_to_image } = req.body;
  if (!title || !url) {
    return res.status(400).json({ error: 'title dan url wajib diisi' });
  }

  // Cek apakah URL sudah pernah disimpan
  db.query('SELECT id FROM news_saved WHERE url = ?', [url], (err, rows) => {
    if (err) {
      console.error('DB select error:', err.message);
      return res.status(500).json({ error: 'Gagal mengecek duplikat' });
    }
    if (rows.length > 0) {
      return res.status(409).json({ message: 'Berita sudah ada di koleksi!', id: rows[0].id, duplicate: true });
    }

    db.query(
      `INSERT INTO news_saved (title, url, url_to_image) VALUES (?, ?, ?)`,
      [title, url, url_to_image || null],
      (err, result) => {
        if (err) {
          console.error('DB insert error:', err.message);
          return res.status(500).json({ error: 'Gagal menyimpan berita' });
        }
        res.json({ message: 'Disimpan!', id: result.insertId });
      }
    );
  });
});

// GET: Ambil semua berita tersimpan
app.get('/api/saved-news', (req, res) => {
  db.query('SELECT * FROM news_saved ORDER BY id DESC', (err, results) => {
    if (err) {
      console.error('DB query error:', err.message);
      return res.status(500).json({ error: 'Gagal mengambil data koleksi' });
    }
    res.json(results);
  });
});

// PUT: Update catatan pribadi
app.put('/api/saved-news/:id', (req, res) => {
  const { note } = req.body;
  db.query(
    'UPDATE news_saved SET note = ? WHERE id = ?',
    [note, req.params.id],
    (err) => {
      if (err) {
        console.error('DB update error:', err.message);
        return res.status(500).json({ error: 'Gagal mengupdate catatan' });
      }
      res.json({ message: 'Catatan berhasil diperbarui!' });
    }
  );
});

// DELETE: Hapus berita dari koleksi
app.delete('/api/saved-news/:id', (req, res) => {
  db.query('DELETE FROM news_saved WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      console.error('DB delete error:', err.message);
      return res.status(500).json({ error: 'Gagal menghapus berita' });
    }
    res.json({ message: 'Berita berhasil dihapus!' });
  });
});

// Tambahkan ini agar Vercel bisa menjalankan aplikasi Anda
module.exports = app;

// Cek apakah sedang dijalankan di komputer lokal (bukan Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log('Server berjalan di port 3000'));
}