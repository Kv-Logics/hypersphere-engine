# Hypersphere Biometric Engine: Hardware & Server Specifications

This document outlines the recommended hardware specifications, GPU requirements, and system configuration setups for deploying the Hypersphere Face Attendance Engine in production.

---

## 1. GPU Specifications

Because the underlying biometric models are highly optimized, the VRAM footprint is exceptionally small:
*   **Total VRAM required for model weights**: **< 500 MB**
*   **Active VRAM during batch execution**: **< 1 GB**

### Recommended GPU Tiering

| Environment | Recommended GPU | VRAM | Type | Target Capacity |
| :--- | :--- | :--- | :--- | :--- |
| **Enterprise Cloud** | **NVIDIA L4** / **NVIDIA T4** | 24 GB / 16 GB | Datacenter | 50+ concurrent verification streams / CCTV feeds |
| **On-Premises Edge** | **NVIDIA RTX 3050** / **RTX 4050** | 6 GB / 8 GB | Consumer/Workstation | 10–15 concurrent kiosk logins |
| **Embedded Kiosk** | **NVIDIA Jetson Orin Nano** | 8 GB | Single Board Computer | Dedicated local camera terminal device |

---

## 2. Server Configurations

### Minimum Specification (CPU-Only Edge/Development)
*   **CPU**: 4 Cores (e.g., Intel Core i5 / AMD Ryzen 5 or equivalent Xeon)
*   **Memory**: 8 GB RAM
*   **GPU**: None (uses CPU Execution Provider for ONNX Runtime/PyTorch)
*   **Storage**: 50 GB SATA SSD
*   **Use Case**: Single kiosk device running local checks. Verification latency: ~80ms.

### Recommended Production Specification (GPU-Accelerated)
*   **CPU**: 8 Cores (Intel Xeon or AMD EPYC)
*   **Memory**: 16 GB RAM (allows optimal PostgreSQL vector cache paging)
*   **GPU**: NVIDIA T4 / L4 (configured with CUDA Execution Provider)
*   **Storage**: 100 GB NVMe SSD
*   **Use Case**: Centralized institutional server handling hundreds of concurrent requests. Verification latency: <30ms.

---

## 3. Host Software & Driver Stack

To configure the application with full hardware acceleration support, install the following driver versions:

*   **Operating System**: Ubuntu 20.04 LTS / 22.04 LTS (recommended)
*   **NVIDIA Display Driver**: Version 525+ (stable)
*   **CUDA Toolkit**: 11.8 or 12.x
*   **cuDNN**: 8.9.x
*   **NVIDIA Container Toolkit**: Required if deploying the stack using Docker containers (e.g. `docker-compose.yml` with GPU capabilities enabled).
