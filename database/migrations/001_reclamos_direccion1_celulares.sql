USE [telefono];
GO

-- Reclamos de telefonia: direccion dictada por el abonado y numeros de celular de contacto
IF COL_LENGTH('ReclamosTelefonia', 'Direccion1') IS NULL
BEGIN
    ALTER TABLE [dbo].[ReclamosTelefonia] ADD [Direccion1] VARCHAR(300) NULL;
END
GO

IF COL_LENGTH('ReclamosTelefonia', 'Celulares') IS NULL
BEGIN
    ALTER TABLE [dbo].[ReclamosTelefonia] ADD [Celulares] VARCHAR(100) NULL;
END
GO

-- Boletas de reparacion: mismos datos propagados desde el reclamo
IF COL_LENGTH('BoletasReparacion', 'Direccion1') IS NULL
BEGIN
    ALTER TABLE [dbo].[BoletasReparacion] ADD [Direccion1] VARCHAR(300) NULL;
END
GO

IF COL_LENGTH('BoletasReparacion', 'Celulares') IS NULL
BEGIN
    ALTER TABLE [dbo].[BoletasReparacion] ADD [Celulares] VARCHAR(100) NULL;
END
GO