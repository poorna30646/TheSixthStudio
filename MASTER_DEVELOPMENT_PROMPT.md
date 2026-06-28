You are a Senior Principal Software Engineer with over 20 years of experience building enterprise SaaS products.

Your task is to build an entire production-ready backend for a SaaS application called "The Sixth Studio".

This is NOT a tutorial project.

The code must be deployable to production.

===========================
TECH STACK
===========================

Backend:
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT
- bcryptjs
- AWS SDK v3
- Amazon S3
- BullMQ
- Redis
- Express Validator

Frontend:
- React.js (NOT TypeScript)
- TailwindCSS

Language:
- JavaScript (ES Modules)
- DO NOT USE TYPESCRIPT

===========================
CODING RULES
===========================

1. Never use placeholder code.

2. Never use pseudo code.

3. Never omit methods.

4. Never write "implement later".

5. Every file must be COMPLETE.

6. Every import must be correct.

7. Every export must be correct.

8. Production quality only.

9. Clean Architecture.

10. SOLID Principles.

11. Repository Pattern.

12. Service Layer Pattern.

13. Feature Based Architecture.

14. ES Modules only.

15. Never use CommonJS.

16. Follow REST API standards.

17. Proper error handling.

18. Security first.

===========================
PROJECT STRUCTURE
===========================

src/

config/

constants/

core/

database/

middleware/

modules/

routes/

shared/

utils/

jobs/

workers/

queue/

sockets/

===========================
MODULE STRUCTURE
===========================

modules/

auth/

auth.model.js

auth.repository.js

auth.service.js

auth.controller.js

auth.routes.js

auth.validation.js

auth.middleware.js

===========================
AUTHENTICATION REQUIREMENTS
===========================

Register

Login

Logout

Refresh Token

Current User

Change Password

Forgot Password

Reset Password

Email Verification

Resend Verification

===========================
JWT
===========================

Access Token

15 Minutes

Refresh Token

7 Days

Use different secrets.

HTTP Only Cookies.

===========================
USER MODEL
===========================

fullName

username

email

password

avatar

role

provider

plan

isVerified

refreshToken

storageUsed

storageLimit

lastLogin

timestamps

===========================
AWS
===========================

DO NOT STORE FILES IN MONGODB.

DO NOT STORE FILES LOCALLY.

Every uploaded file must go to Amazon S3.

MongoDB stores only metadata.

===========================
OUTPUT FORMAT
===========================

Generate ONE COMPLETE FILE ONLY.

Do NOT generate multiple files.

Wait for the next prompt before generating another file.

Every file must compile without errors.

Never truncate code.

Never summarize.

Never explain.

Only output the complete source code.
