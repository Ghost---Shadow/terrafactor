# Terrafactor

Refactors terraform code generated by [terraformer](https://github.com/GoogleCloudPlatform/terraformer).

It does two things

1. Merges all the terraform states.
2. Some [post processing](#post-processing)

## Installation

Requires [nodejs](https://nodejs.org/en/)

```sh
npm i -g terrafactor
```

## Usage

```sh
terrafactor ./inputDir ./outputDir
```

It will generate three directories `./outputDir`, `./outputDir_mst` and `./outputDir_processed`.

If you want to opt out of the modularize feature. You can run.

```sh
terrafactor ./inputDir ./outputDir --modularize=false
```

## Post processing

Currently it does the following postprocessing steps

1. Replaces all hardcoded `id` with `"${resource_type.resource_name.id}"`
2. Maintains [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)-ness by refactoring out repeated values into a `variables.tf` file.
3. Generate modules containing clusters of all connected components. Then have the `main.tf` import all the modules. `mod_0` constains all resources which have a very small cluster `( < 2 )`

Planned

1. Support for `count` property of terraform.
