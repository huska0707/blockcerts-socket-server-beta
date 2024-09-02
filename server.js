const express = require('express')
const app = express()
const PORT = 4000

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const http = require('http').Server(app)
const cors = require('cors')

app.use(cors())

const socketIO = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
})

const userEmails = new Map()

const getSocketIdsByEmail = async (email) => {
    const socketIds = []
    for (const [socketId, storedEmail] of userEmails.entries()) {
        if (storedEmail === email) {
            socketIds.push(socketId)
        }
    }

    return socketIds
}


const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
} 

socketIO.on('connection', (socket) => {
    const userEmail = socket.handshake.query.email

    if(!isValidEmail(userEmail)) {
        console.log(`Invalid email format: ${userEmail}`)
        return
    }

    console.log(`User ${userEmail} connected with socket ID ${socket.id}`)
    console.log(userEmails)

    if (userEmails.has(userEmail)) {
        console.log(`User with email ${userEmail} already exists. Updating socket ID.`);
        userEmails.set(userEmail, socket.id)
    } else {
        // Add the user to the userEmails
        userEmails.set(userEmail, socket.id);
    }

    socket.on('disconnect', () => {
        console.log(`User ${userEmail} disconnected`)
    })
})

app.post("/api/", async (req, res) => {
    const { schoolEmail, studentEmail, status } = req.body

    console.log(schoolEmail, studentEmail, status)

    if (studentEmail) {
        // Send notification to a specific student
        const socketId = await getSocketIdsByEmail(studentEmail)

        if (socketId) {
            console.log("socket ID: ", socketId)
            socketIO.to(socketId).emit('notification', { status })
            console.log(`Sent notification to student ${studentEmail} from school ${schoolEmail}`)
        } else {
            console.log(`Student ${studentEmail} from school ${schoolEmail} not found`)
        }
    } else {
        // Send notification to all students of the school
        const studentEmails = userEmails.get(schoolEmail)
        if (studentEmails) {
            for (const email of studentEmails) {
                const socketId = userEmails.get(`${schoolEmail}-${email}`)
                socketIO.to(socketId).emit('notification', { status })
            }
            console.log(`Sent notification to all students of school ${schoolEmail}`)
        } else {
            console.log(`No students found for school ${schoolEmail}`)
        }
    }

    res.status(200).json({ message: 'Notification sent' })
})


/**
 * This event is used to notice and update the school's dashboard...
 */
app.post("/api/order-create", async (req, res) => {
    const { schoolEmail, studentEmail } = req.body

    if(!schoolEmail || !studentEmail) {
        return res.status(400).json({ error: "Missing required fields" })
    }

    try {
        const socketId = await getSocketIdsByEmail(schoolEmail)

        if(socketId) {
            console.log("Socket ID: ", socketId)
            socketIO.to(socketId).emit('order-created', { studentEmail })
            console.log(`Sent created event to school ${schoolEmail}`)
            return res.status(200).json({ message: "Order created event sent" })
        } else {
            console.log(`No schools found for email ${schoolEmail}`)
            return res.status(404).json({ error: `No schools found for email ${schoolEmail}` })
        }
    } catch (error) {
        console.error("Error in /api/order-create: ", error)
        return res.status(500).json({ error: "Internal server error" })
    }
})


app.get('/', (req, res) => {
    res.send('This is the blockcerts socket server!')
})


http.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`)
})