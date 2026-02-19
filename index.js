const express = require("express")
const path = require("path")
const data = require("./movies.json")
const { Pool } = require("pg")

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const app = express();

app.use('/src', express.static('src'));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/api/movies", (req, res) => {
    res.json(data.movies)
})

// Route de test PostgreSQL - crée la table et affiche les données
app.get("/api/db-test", async (req, res) => {
    try {
        // Créer la table users si elle n'existe pas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Récupérer tous les utilisateurs
        const result = await pool.query('SELECT * FROM users ORDER BY id');
        
        res.json({ 
            success: true, 
            message: "PostgreSQL fonctionne !",
            users: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
})

// Route pour ajouter un utilisateur
app.get("/api/add-user", async (req, res) => {
    try {
        // Créer la table si elle n'existe pas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const result = await pool.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
            ['Test User', 'test@example.com']
        );
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.json({ error: error.message });
    }
})

app.listen(process.env.PORT || 8080, () => {
    console.log(`Serveur démarré sur le port 8080`)
});