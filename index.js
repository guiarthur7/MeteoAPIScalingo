const express = require("express")
const port = 8080

const app = express();

app.get("/", (req, res) => {
    res.send("Salut c'est Jean")
})

app.listen(port, () => {
    console.log("Serveur démarré avec succès")
});