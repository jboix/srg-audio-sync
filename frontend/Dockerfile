FROM node:20.18 AS build

WORKDIR /usr/src/app
COPY . ./
RUN npm ci
RUN npm run build

FROM nginx:latest

COPY --from=build /usr/src/app/dist /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
