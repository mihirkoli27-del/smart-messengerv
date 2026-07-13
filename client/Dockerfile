# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Nginx stage for hosting static build files
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom nginx configuration to handle React Router SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
