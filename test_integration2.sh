# Create a backup of .terraform
rm -rf ./.terraform
mv ./terrafactor_output/.terraform ./.terraform

# Clear all generated directories
rm -rf ./terrafactor_output
rm -rf ./terrafactor_output_processed

# Copy the .terraform back
mkdir ./terrafactor_output
cp -a ./.terraform ./terrafactor_output/.terraform
mkdir ./terrafactor_output_processed
cp -a ./.terraform ./terrafactor_output_processed/.terraform 

# Start the process
node src/index.js ../terraformer/generated/alicloud ./terrafactor_output --modularize=false

# Validate the terrafactor_output
cd ./terrafactor_output
terraform init
terraform validate
# terraform plan

# Validate the terrafactor_output_processed
cd ../terrafactor_output_processed
terraform init
terraform validate
terraform plan
