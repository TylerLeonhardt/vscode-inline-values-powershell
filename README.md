# Inline values for PowerShell variables

![image](https://user-images.githubusercontent.com/2644648/109373505-0cb23380-7864-11eb-8bf2-a991873b6d02.png)

This extension enables inline values for variables _when debugging_ a PowerShell script.

## Features

![image](https://user-images.githubusercontent.com/2644648/109373154-19358c80-7862-11eb-8a7c-a5a7b34f0561.png)

When you apply the `"debug.inlineValues": true` setting, you can see the values for the variables in your script inline.

## Requirements

The PowerShell extension or the PowerShell Preview extension for VS Code

## Development

Wanna contribute? It's easy!

### Prereqs

* [Node.js LTS](https://nodejs.org/en/download/)
* [Yarn](https://yarnpkg.com/)

### Steps

1. Clone this repo and `cd` into it
2. Run `yarn` to install the dependencies
3. Open it in VS Code (ideally insiders)
4. `Ctrl/Cmd+Shift+B` to run the build task (look in the terminal drop down to see if the build is running)
5. `F5` to launch the local build of the extension

That's it! Then all you have to do is:

1. Make code changes
2. Save the files
3. Restart your local build to see the changes :)
