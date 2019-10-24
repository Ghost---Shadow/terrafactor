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

It will generate two directories `./outputDir` and `./outputDir_processed`.

## Post processing

Currently it does the following postprocessing steps

1. Replaces all hardcoded `id` with `"${resource_type.resource_name.id}"`
2. Maintains [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)-ness by refactoring out repeated values into a `variables.tf` file.

Planned

1. Generate a forest of minimum spanning trees of connected components and make one module per tree. Then have the `main.tf` import all the modules.
2. Support for `count` property of terraform.
