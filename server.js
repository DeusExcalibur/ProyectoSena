require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

(async () => {
    try {
        const connection = await db.getConnection();
        console.log("✅ Conexión con la base de datos establecida correctamente.");
        connection.release();
    } catch (error) {
        console.error("❌ Error al conectar con la base de datos varias funciones no serviran:", error);
    }
})();

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "paginaPrincipal.html"));
});

app.get("/iniciarSesion", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "iniciarSesion.html"));
});

app.post("/iniciarSesion", async (req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await db.query(`SELECT usuarios.correo, usuarios.contrasena, usuarios.nombre1 AS nombre, usuarios.apellido1 AS apellido, planes.nombre_plan 
            FROM usuarios 
            INNER JOIN planes ON usuarios.id_plan = planes.id_plan
            WHERE usuarios.correo = ? AND usuarios.contrasena = ?`, 
            [email, password]);

        if (rows.length > 0) {
            const user = rows[0];

            let pagina = "paginaPrincipalLoggeada.html";
            
            if (user.nombre_plan.toLowerCase() === "premium") {
                pagina = "paginaPrincipalPremium.html";
            } else if (user.nombre_plan.toLowerCase() === "admin") {
                pagina = "paginaPrincipalAdmin.html";
            }

            const url = `/${pagina}?nombre=${encodeURIComponent(user.nombre)}&apellido=${encodeURIComponent(user.apellido)}&plan=${encodeURIComponent(user.nombre_plan)}`;

            return res.json({ redirectUrl: url });
        } else {
            return res.status(401).json({ error: "Correo o contraseña incorrectos" });
        }
    } catch (error) {
        console.error("Error en la consulta:", error);
        res.status(500).send("Error interno del servidor");
    }
});

app.get("/crearCuenta", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "crearCuenta.html"));
});

app.post("/crearCuenta", async (req, res) => {
    const { nombre1, nombre2, apellido1, apellido2, tipoDocumento, numeroDocumento, correo, password } = req.body;

    try {
        const [existingUser] = await db.query(
            `SELECT * FROM usuarios WHERE correo = ? OR documento = ?`,
            [correo, numeroDocumento]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: "El correo o el número de documento ya están registrados." });
        }

        await db.query(
            `INSERT INTO usuarios (nombre1, nombre2, apellido1, apellido2, tipoDocumento, documento, correo, contrasena, id_plan) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nombre1, nombre2, apellido1, apellido2, tipoDocumento, numeroDocumento, correo, password, 1] // id_plan = 1 asumiendo que es el plan por defecto
        );

        res.status(201).json({ message: "Cuenta creada exitosamente." });
    } catch (error) {
        console.error("Error al crear la cuenta:", error);
        res.status(500).json({ error: "Error interno del servidor al crear la cuenta." });
    }
});

app.get("/generalError", (req, res, next) => {
    const error = new Error("¡Esto es un error general!");
    error.status = 400;
    next(error);
});

app.get("/error", (req, res, next) => {
    const error = new Error("¡Esto es un error intencional!");
    error.status = 500;
    next(error);
});

app.use((req, res, next) => {
    console.log("Ruta no encontrada:", req.url);
    const error = new Error("Ruta no encontrada");
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    console.error("Error detectado:", err);

    if (err.status === 404) {
        return res.status(404).sendFile(path.join(__dirname, "public", "error404.html"));
    }
    
    if (err.status === 500) {
        return res.status(500).sendFile(path.join(__dirname, "public", "error500.html"));
    }
    
    if (err.status) {
        return res.status(err.status).sendFile(path.join(__dirname, "public", "errorGeneral.html"));
    }

    res.status(err.status).sendFile(path.join(__dirname, "public", "errorGeneral.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});