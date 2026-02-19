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

// Route pour ajouter un utilisateur
app.get("/api/add-user", async (req, res) => {
    try {
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