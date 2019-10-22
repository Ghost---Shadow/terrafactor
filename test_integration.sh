# Create a backup of .terraform
rm -rf ./.terraform
mv ./terrafactor_output/.terraform ./terraform

# Clear both generated directories
rm -rf ./terrafactor_output
rm -rf ./terrafactor_output_processed

# Start the process
npm start ../terraformer/generated/alicloud ./terrafactor_output
# npm link
# terrafactor ../terraformer/generated/alicloud ./terrafactor_output

# Copy the .terraform back
cp -a ./.terraform ./terrafactor_output/.terraform 
cp -a ./.terraform ./terrafactor_output_processed/.terraform 

# Validate the terrafactor_output
cd ./terrafactor_output
terraform init
terraform validate
# terraform plan

# Validate the terrafactor_output_processed
cd ../terrafactor_output_processed
terraform init
terraform validate
# terraform plan
