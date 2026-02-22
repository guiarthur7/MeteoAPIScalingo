require('dotenv').config();
const express = require("express")
const path = require("path")
const data = require("./movies.json")
const { Pool } = require("pg")
const bcrypt = require("bcrypt")

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

async function initDatabase() {
    try {
        const testResult = await pool.query('SELECT NOW()');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS movies (
                id SERIAL PRIMARY KEY,
                imdb_id VARCHAR(50) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                year VARCHAR(20),
                poster TEXT,
                type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, movie_id)
            );
        `);

        // Importer les films depuis movies.json si la table est vide
        const countResult = await pool.query('SELECT COUNT(*) FROM movies');
        const movieCount = parseInt(countResult.rows[0].count);
        
        if (movieCount === 0) {
            const moviesData = require('./movies.json').movies;
            
            for (const movie of moviesData) {
                try {
                    await pool.query(
                        'INSERT INTO movies (imdb_id, title, year, poster, type) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (imdb_id) DO NOTHING',
                        [movie.imdbID, movie.Title, movie.Year, movie.Poster, movie.Type]
                    );
                } catch (err) {
                }
            }
        }
    } catch (error) {
        console.error('Erreur initialisation base de données:', error);
        throw error;
    }
}

const app = express();

app.use(express.json());

app.use('/src', express.static('src'));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"))
})

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "register.html"))
})

app.get("/liked", (req, res) => {
    res.sendFile(path.join(__dirname, "liked.html"))
})

app.get("/api/movies", async (req, res) => {
    try {
        const result = await pool.query('SELECT id, imdb_id as "imdbID", title as "Title", year as "Year", poster as "Poster", type as "Type" FROM movies ORDER BY id');
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur récupération films:', error);
        res.json([]);
    }
})

// Route d'inscription
app.post("/api/signup", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: "Nom d'utilisateur et mot de passe requis" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            res.json({ success: false, message: "Ce nom d'utilisateur existe déjà" });
        } else {
            res.json({ success: false, message: error.message || "Erreur lors de l'inscription" });
        }
    }
});

// Route de connexion
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: "Nom d'utilisateur et mot de passe requis" });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        
        if (!user) {
            return res.json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
        }
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username
            } 
        });
    } catch (error) {
        res.json({ success: false, message: "Erreur lors de la connexion" });
    }
});

// Ajouter un like
app.post("/api/likes", async (req, res) => {
    const { userId, imdbId } = req.body;
    
    if (!userId || !imdbId) {
        return res.json({ success: false, message: "Données manquantes" });
    }

    try {
        // Récupérer l'ID du film depuis la table movies
        const movieResult = await pool.query('SELECT id FROM movies WHERE imdb_id = $1', [imdbId]);
        
        if (movieResult.rows.length === 0) {
            return res.json({ success: false, message: "Film introuvable" });
        }
        
        const movieId = movieResult.rows[0].id;
        
        await pool.query(
            'INSERT INTO likes (user_id, movie_id) VALUES ($1, $2)',
            [userId, movieId]
        );
        res.json({ success: true });
    } catch (error) {
        if (error.code === '23505') {
            res.json({ success: false, message: "Film déjà liké" });
        } else {
            res.json({ success: false, message: "Erreur lors de l'ajout du like" });
        }
    }
});

// Retirer un like
app.delete("/api/likes/:userId/:imdbId", async (req, res) => {
    const { userId, imdbId } = req.params;
    
    try {
        // Récupérer l'ID du film depuis la table movies
        const movieResult = await pool.query('SELECT id FROM movies WHERE imdb_id = $1', [imdbId]);
        
        if (movieResult.rows.length === 0) {
            return res.json({ success: false, message: "Film introuvable" });
        }
        
        const movieId = movieResult.rows[0].id;
        
        await pool.query('DELETE FROM likes WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: "Erreur lors de la suppression du like" });
    }
});

// Récupérer les films likés d'un utilisateur
app.get("/api/likes/:userId", async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await pool.query(
            `SELECT 
                m.imdb_id as "imdbID",
                m.title as "Title",
                m.poster as "Poster",
                m.year as "Year",
                m.type as "Type"
            FROM likes l
            JOIN movies m ON l.movie_id = m.id
            WHERE l.user_id = $1
            ORDER BY l.created_at DESC`,
            [userId]
        );
        res.json({ success: true, likes: result.rows });
    } catch (error) {
        res.json({ success: false, message: "Erreur lors de la récupération des likes" });
    }
});

// Démarrage du serveur après init DB
async function startServer() {
    await initDatabase();
    
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Serveur démarré sur le port ${PORT}`)
    });
}

startServer();