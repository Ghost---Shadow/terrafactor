mv ./terrafactor_output/.terraform ./.terraform
rm -rf ./terrafactor_output
npm start ../terraformer/generated/alicloud ./terrafactor_output
# terrafactor ../terraformer/generated/alicloud ./terrafactor_output
mv ./.terraform ./terrafactor_output/.terraform 
cd ./terrafactor_output
terraform init
terraform refresh