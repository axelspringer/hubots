# Builds a Docker to deliver SSR
FROM node:carbon

# create app directory
WORKDIR /usr/src/app

# support (npm@5+)
COPY package*.json ./

# install && link
RUN npm install --only production

# assets
COPY . .

# run on 8080
EXPOSE 8080
ENTRYPOINT [ "./bin/hubots" ]
