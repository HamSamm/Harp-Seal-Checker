
# The Seal Checker 9000

A web app designed to help analyze harp seal population data taken around NL, pulling data from [FSDH](https://www.canada.ca/en/shared-services/services/tools-to-equip-gc-workers/tools-science/federal-science-datahub.html) via Azure Blob Storage. (Not meant to be taken seriously, purely for educational purposes)
Made as an example project for the [FSDH Web App Hosting](https://www.canada.ca/en/shared-services/services/tools-to-equip-gc-workers/tools-science/federal-science-datahub/fsdh-overview/azure-app-service.html) feature for transferring Flask-based web application. This should work for other storage systems that use Azure Blob Storage.

---

## Prerequisites

Before getting started, make sure you have the following installed and set up on your system:

- **[VS Code](https://code.visualstudio.com/)**
- **[WSL 2 (Ubuntu)](https://learn.microsoft.com/en-us/windows/wsl/install)** installed on Windows.
- **[WSL Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl)** for VS Code.
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (with WSL 2 backend integration enabled in settings).

And have access to:
- **Azure Blob Storage SAS Key** (Shared Access Signature key with read permissions to access the dataset container).

---

## Step 1: Open Project in VS Code using WSL

1. Open **VS Code**.
2. Press `F1` (or `Ctrl + Shift + P`) to open the Command Palette.
3. Type and select **`WSL: Connect to WSL`** (or open your Ubuntu terminal).
4. Clone the repository inside your Ubuntu environment and open in **VS Code**:
   ```bash
   git clone https://github.com/HamSamm/Harp-Seal-Checker.git
   cd Harp-Seal-Checker
   code .
   ```
## Step 2: Run Project
1. After opening, grab the correct SAS Token for the Azure Blob Storage that contains the [Seal Data](https://open.canada.ca/data/en/dataset/7538501c-cd3d-4ee0-8b4a-476a625957d6)
2. Build the Docker Image
   ```bash
   docker build -t harp-seal-checker
   ```
4. Launch with SAS Token as an environment variable
   ```bash
   docker run -p 5000:5000 -e AZURE_SAS_TOKEN="TOKEN_HERE" harp-seal-checker
   ```
6. Open on http://localhost:5000

