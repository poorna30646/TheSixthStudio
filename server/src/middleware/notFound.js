import ApiError from "../utils/ApiError.js";
import HTTP_STATUS from "../constants/httpStatus.js";

const notFound = (req, res, next) => {
    next(
        new ApiError(
            HTTP_STATUS.NOT_FOUND,
            `Cannot ${req.method} ${req.originalUrl}`
        )
    );
};

export default notFound;