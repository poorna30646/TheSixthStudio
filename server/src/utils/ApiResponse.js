// Standard API response utility.
class ApiResponse {
    constructor(statusCode, message = "Success", data = null) {
        this.success = true;
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.timestamp = new Date().toISOString();
    }
}

export default ApiResponse;