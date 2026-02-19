const express = require("express")
const path = require("path")
const data = require("./movies.json")
const { Pool } = require("pg")
const bcrypt = require("bcrypt")

// Connexion PostgreSQL Scalingo
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Créer les tables si elles n'existent pas
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        movie_id VARCHAR(50) NOT NULL,
        movie_title VARCHAR(255) NOT NULL,
        movie_poster TEXT NOT NULL,
        movie_year VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, movie_id)
    );
`);

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

app.get("/api/movies", (req, res) => {
    res.json(data.movies)
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
        console.error('Erreur inscription:', error.message, error.code);
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
    const { userId, movieId, movieTitle, moviePoster, movieYear } = req.body;
    
    if (!userId || !movieId) {
        return res.json({ success: false, message: "Données manquantes" });
    }

    try {
        await pool.query(
            'INSERT INTO likes (user_id, movie_id, movie_title, movie_poster, movie_year) VALUES ($1, $2, $3, $4, $5)',
            [userId, movieId, movieTitle, moviePoster, movieYear]
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
app.delete("/api/likes/:userId/:movieId", async (req, res) => {
    const { userId, movieId } = req.params;
    
    try {
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
            'SELECT movie_id, movie_title, movie_poster, movie_year FROM likes WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, likes: result.rows });
    } catch (error) {
        res.json({ success: false, message: "Erreur lors de la récupération des likes" });
    }
});

app.listen(process.env.PORT || 8080, () => {
    console.log(`Serveur démarré sur le port 8080`)
});