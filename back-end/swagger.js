const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('../front-end/config'); // Import the configuration
const baseURL = config.baseURL; // Get the baseURL from the configuration

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Toll Interoperability API',
            version: '1.0.0',
            description: 'API documentation for toll application',
        },
        servers: [
            { url: "http://localhost:9115" }
        ]
    },
    apis: ['./server.js'], // Διαδρομές όπου υπάρχουν τα endpoints
};

const SwaggerDocs = swaggerJSDoc(swaggerOptions);
module.exports = (app) => {
    app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(SwaggerDocs));

    app.get('/swagger.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(SwaggerDocs);
    });

    app.listen(() => console.log(`Το OpenAPI Documentation βρίσκεται στο ${baseURL}/api-docs!`));
}
