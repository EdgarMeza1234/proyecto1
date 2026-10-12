USE [telefono];
GO

-- ============================================================
-- Modulo Teliskratel: registro persistente de los archivos .out
-- de la central (teliskratel.out = REG_STATUS, teliskratel6.out = IFACE).
-- Ver backend/services/teliskratel.service.js (ensureTeliskratelTable).
-- ============================================================

IF OBJECT_ID('dbo.teliskratel') IS NULL
CREATE TABLE [dbo].[teliskratel] (
    [id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_teliskratel] PRIMARY KEY,
    [lote_import] VARCHAR(20) NOT NULL,
    [fecha_import] DATETIME NOT NULL DEFAULT GETDATE(),
    [origen_archivo] NVARCHAR(200) NOT NULL,
    [tipo_formato] VARCHAR(20) NOT NULL,
    [creado_por] NVARCHAR(100) NULL,
    [node] NVARCHAR(20) NULL,
    [directory_number] NVARCHAR(50) NULL,
    [dn_digitos] NVARCHAR(40) NULL,
    [registration_status] NVARCHAR(120) NULL,
    [basic_service] NVARCHAR(120) NULL,
    [interface_access] NVARCHAR(120) NULL,
    [subscriber_type] NVARCHAR(80) NULL,
    [supplementary_service_set] NVARCHAR(120) NULL,
    [estado_registro] VARCHAR(20) NULL,
    [registro_detalle] NVARCHAR(120) NULL,
    [ip_origen] VARCHAR(45) NULL,
    [central] NVARCHAR(60) NULL,
    [puerto] NVARCHAR(20) NULL,
    [suspendido] BIT NOT NULL DEFAULT 0,
    [bloqueo] NVARCHAR(30) NULL,
    [linea_raw] NVARCHAR(400) NULL,
    [hash_linea] CHAR(64) NOT NULL
);
GO

IF OBJECT_ID('dbo.teliskratel_import') IS NULL
CREATE TABLE [dbo].[teliskratel_import] (
    [id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_teliskratel_import] PRIMARY KEY,
    [lote_import] VARCHAR(20) NOT NULL,
    [fecha_import] DATETIME NOT NULL DEFAULT GETDATE(),
    [origen_archivo] NVARCHAR(200) NOT NULL,
    [tipo_formato] VARCHAR(20) NOT NULL,
    [filas_leidas] INT NOT NULL DEFAULT 0,
    [insertados] INT NOT NULL DEFAULT 0,
    [duplicados] INT NOT NULL DEFAULT 0,
    [errores] INT NOT NULL DEFAULT 0,
    [creado_por] NVARCHAR(100) NULL
);
GO

-- Indices
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_dn' AND object_id = OBJECT_ID('dbo.teliskratel'))
    CREATE INDEX [IX_teliskratel_dn] ON [dbo].[teliskratel] ([dn_digitos]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_archivo' AND object_id = OBJECT_ID('dbo.teliskratel'))
    CREATE INDEX [IX_teliskratel_archivo] ON [dbo].[teliskratel] ([origen_archivo], [fecha_import]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_estado' AND object_id = OBJECT_ID('dbo.teliskratel'))
    CREATE INDEX [IX_teliskratel_estado] ON [dbo].[teliskratel] ([estado_registro]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_central' AND object_id = OBJECT_ID('dbo.teliskratel'))
    CREATE INDEX [IX_teliskratel_central] ON [dbo].[teliskratel] ([central]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_teliskratel_lote_hash' AND object_id = OBJECT_ID('dbo.teliskratel'))
    CREATE UNIQUE INDEX [UX_teliskratel_lote_hash] ON [dbo].[teliskratel] ([lote_import], [hash_linea]);
GO
