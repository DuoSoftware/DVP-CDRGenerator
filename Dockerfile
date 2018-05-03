#FROM ubuntu
#RUN apt-get update
##RUN apt-get install -y git nodejs npm
#RUN git clone git://github.com/DuoSoftware/DVP-CDRGenerator.git /usr/local/src/cdrgenerator
#RUN cd /usr/local/src/cdrgenerator; npm install
#CMD ["nodejs", "/usr/local/src/cdrgenerator/app.js"]

##EXPOSE 8859

FROM node:9.9.0
ARG VERSION_TAG
RUN git clone -b $VERSION_TAG https://github.com/DuoSoftware/DVP-CDRGenerator.git /usr/local/src/cdrgenerator
RUN cd /usr/local/src/cdrgenerator;
WORKDIR /usr/local/src/cdrgenerator
RUN npm install
EXPOSE 8859
CMD [ "node", "/usr/local/src/cdrgenerator/app.js" ]
