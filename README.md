Note for HamSamm:
cd ~/Harp-Seal-Checker

docker build -t harp-seal-checker . 
docker run -p 5000:5000 -e SAS="sas-key-here" harp-seal-checker
