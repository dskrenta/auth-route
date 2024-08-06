const express = require('express')
const jwt = require('jsonwebtoken')
const proxy = require('express-http-proxy')

// JWT secret key
const JWT_SECRET = 'secret'

// Server port
const PORT = 3000

// Project to user and k8 service mappings
// This is a simple example, in production this would be stored in a database for dynamic lookups
const PROJECT_USER_MAPPINGS = {
  'project1': {
    userId: 'user1',
    k8Service: 'project1-service.default.svc.cluster.local'
  }
}

const app = express()

// Extract subdomain from hostname helper function
function parseSubdomain(hostname) {
  const parts = hostname.split('.')
  return parts.length > 1 ? parts[0] : null
}

// Middleware to extract user from JWT token in Authorization header
function auth(req, res, next) {
  // Extract token from Authorization header
  const token = req.headers.authorization

  if (token) {
    // Verify token and extract user
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user
      }
    })
  }

  // Continue to next route
  next()
}

// Apply auth middleware to all routes
app.use(auth)

// Generate a JWT token for a user
app.get('/generate-token', (req, res) => {
  // Generate token for user1 by default, or the user specified in the query string
  const token = jwt.sign({ userId: req.query.userId || 'user1' }, JWT_SECRET)

  // Send token as response
  res.send(token)
})

// Test route
app.get('/test', (req, res) => {
  res.send('Hello from auth service')
})

// Proxy all requests to the appropriate k8 service based on the subdomain
app.get('*', async (req, res, next) => {
  // Extract projectId from subdomain
  const projectId = parseSubdomain(req.hostname)

  if (projectId) {
    // Get project details from projectId
    const project = PROJECT_USER_MAPPINGS[projectId]

    // Verify project exists and user is authorized to acccess it
    if (!project || req.user?.userId !== project.userId) {
      return res.status(403).send('Forbidden')
    }

    // Log the proxying of the request
    console.log(`Proxying ${project.userId} request to ${project.k8Service} (${projectId})`)

    // Proxy request to k8 service contained in project
    proxy(project.k8Service)(req, res, next)
  } else {
    // If no projectId is found, continue to 404 route
    next()
  }
})

// 404 route
app.get('*', (req, res) => {
  res.status(404).send('404 Not found')
})

// Start the server
app.listen(PORT, () => {
  console.log('Auth service listening on port 3000')
})
