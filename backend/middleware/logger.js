const morgan = require('morgan');

const logger = morgan(':method :url :status :response-time ms - :remote-addr');

module.exports = logger;
